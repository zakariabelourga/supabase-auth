import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemEntry, ItemDetail, Tag } from '$lib/types'; // ItemDetail includes notes and more comprehensive relations
import { findOrCreateTagsForTeam, linkTagsToItem, syncItemTags } from './tags';

// Define a more specific return type if possible, or adjust ItemWithRelations
// to accurately reflect what's being selected. For now, using ItemEntry for lists and ItemDetail for single item views.

/**
 * Fetches all items for a given team, including related category, tags, and entity.
 * Items are ordered by expiration date (ascending).
 *
 * @param supabase - The Supabase client instance.
 * @param teamId - The ID of the team whose items are to be fetched.
 * @returns A promise that resolves to an array of items or throws an error.
 */
export async function listItemsForTeam(
	supabase: SupabaseClient,
	teamId: string
): Promise<ItemEntry[]> {
	const { data, error } = await supabase
		.from('items')
		.select(
			`
      id,
      name,
      description,
      expiration,
      created_at,
      updated_at,
      user_id, 
      team_id,
      category: categories ( id, name ),
      entity: entities ( id, name, team_id ),
      tags: tags ( id, name, team_id ),
      entity_name_manual
    `
		)
		.eq('team_id', teamId)
		.order('expiration', { ascending: true });

	if (error) {
		console.error('Error fetching items for team:', error);
		throw error;
	}

	const mappedData: ItemEntry[] = (data || []).map((item) => ({
		...item,
		category: Array.isArray(item.category) ? item.category[0] || null : item.category || null,
		entity: Array.isArray(item.entity) ? item.entity[0] || null : item.entity || null,
		tags: item.tags || []
	}));

	return mappedData;
}

// --- Helper function to resolve entity ---
async function _resolveEntity(
	supabase: SupabaseClient,
	teamId: string,
	entityNameManual: string | null | undefined
): Promise<{ entityIdToSave: string | null; entityNameManualToSave: string | null }> {
	let entityIdToSave: string | null = null;
	let entityNameManualToSave: string | null = entityNameManual?.trim() || null;

	if (entityNameManualToSave) {
		const { data: matchingEntity, error: entityCheckError } = await supabase
			.from('entities')
			.select('id, name, team_id')
			.eq('team_id', teamId)
			.eq('name', entityNameManualToSave)
			.maybeSingle();

		if (entityCheckError) {
			console.error('Error checking for existing entity:', entityCheckError);
		}

		if (matchingEntity) {
			entityIdToSave = matchingEntity.id;
			entityNameManualToSave = null;
		}
	}
	return { entityIdToSave, entityNameManualToSave };
}

// Define the structure for the data needed to create an item
export interface CreateItemPayload {
	teamId: string;
	creatorUserId: string;
	name: string;
	description: string | null;
	categoryId: string | null;
	expiration: string;
	tagsString: string | null;
	entityNameManual: string | null;
}

/**
 * Creates a new item, handles entity lookup/creation, and manages tags.
 *
 * @param supabase The Supabase client instance.
 * @param itemData The data for the new item.
 * @returns The ID of the newly created item.
 * @throws Throws an error if item creation or tag handling fails.
 */
export async function createItem(
	supabase: SupabaseClient,
	itemData: CreateItemPayload
): Promise<{ id: string; itemAddedButTagsFailed?: boolean; tagErrorMessage?: string }> {
	const { teamId, creatorUserId, name, description, categoryId, expiration, tagsString, entityNameManual } =
		itemData;

	const { entityIdToSave, entityNameManualToSave } = await _resolveEntity(
		supabase,
		teamId,
		entityNameManual
	);

	const { data: newItemData, error: insertError } = await supabase
		.from('items')
		.insert({
			name: name,
			description: description,
			category_id: categoryId || null,
			expiration: expiration,
			user_id: creatorUserId,
			team_id: teamId,
			entity_id: entityIdToSave,
			entity_name_manual: entityNameManualToSave
		})
		.select('id')
		.single();

	if (insertError || !newItemData) {
		console.error('Error inserting item into database:', insertError);
		throw new Error(`Database error adding item: ${insertError?.message ?? 'Unknown error'}`);
	}

	const newItemId = newItemData.id;

	const tagNames =
		tagsString
			?.split(',')
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0) ?? [];

	if (tagNames.length > 0) {
		try {
			const tagIds = await findOrCreateTagsForTeam(supabase, teamId, creatorUserId, tagNames);
			if (tagIds.length > 0) {
				await linkTagsToItem(supabase, newItemId, tagIds);
			}
		} catch (tagError: unknown) {
			console.error('Error handling tags for new item via service:', tagError);
			const errorMessage = tagError instanceof Error ? tagError.message : String(tagError);
			return { id: newItemId, itemAddedButTagsFailed: true, tagErrorMessage: errorMessage };
		}
	}

	return { id: newItemId };
}

/**
 * Deletes an item by its ID, ensuring it belongs to the specified team.
 *
 * @param supabase The Supabase client instance.
 * @param itemId The ID of the item to delete.
 * @param teamId The ID of the team that owns the item.
 * @throws Throws an error if the deletion fails or if the item is not found for the team.
 */
export async function deleteItemById(
	supabase: SupabaseClient,
	itemId: string,
	teamId: string
): Promise<void> {
	const { error, count } = await supabase
		.from('items')
		.delete()
		.match({ id: itemId, team_id: teamId });

	if (error) {
		console.error('Error deleting item from database:', error);
		throw new Error(`Database error deleting item: ${error.message}`);
	}

	if (count === 0) {
		console.warn(
			`Attempted to delete item ${itemId} for team ${teamId}, but no matching item was found.`
		);
		throw new Error('Item not found or not owned by team.');
	}
}

// Define the structure for the data needed to update an item
export interface UpdateItemPayload {
	itemId: string;
	teamId: string;
	modifierUserId: string;
	name: string;
	description: string | null;
	categoryId: string | null;
	expiration: string;
	tagsString: string | null;
	entityNameManual: string | null;
}

/**
 * Updates an existing item, handles entity lookup/creation, and manages tags.
 *
 * @param supabase The Supabase client instance.
 * @param itemData The data for updating the item.
 * @returns An object indicating success or if tags failed.
 * @throws Throws an error if item update or critical tag handling fails.
 */
export async function updateItemWithRelations(
	supabase: SupabaseClient,
	itemData: UpdateItemPayload
): Promise<{ itemUpdatedButTagsFailed?: boolean; tagErrorMessage?: string }> {
	const {
		itemId,
		teamId,
		modifierUserId,
		name,
		description,
		categoryId,
		expiration,
		tagsString,
		entityNameManual
	} = itemData;

	const { entityIdToSave, entityNameManualToSave } = await _resolveEntity(
		supabase,
		teamId,
		entityNameManual
	);

	const { error: updateError, count } = await supabase
		.from('items')
		.update({
			name: name,
			description: description,
			category_id: categoryId || null,
			expiration: expiration,
			user_id: modifierUserId,
			entity_id: entityIdToSave,
			entity_name_manual: entityNameManualToSave,
			updated_at: new Date().toISOString()
		})
		.match({ id: itemId, team_id: teamId });

	if (updateError) {
		console.error('Error updating item in database:', updateError);
		throw new Error(`Database error updating item: ${updateError.message}`);
	}

	if (count === 0) {
		console.warn(
			`Attempted to update item ${itemId} for team ${teamId}, but no matching item was found.`
		);
		throw new Error('Item not found or not owned by team, update failed.');
	}

	const tagNames =
		tagsString
			?.split(',')
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0) ?? [];

	try {
		await syncItemTags(supabase, itemId, teamId, modifierUserId, tagNames);
	} catch (tagError: unknown) {
		console.error('Error syncing tags for item via service:', tagError);
		const errorMessage = tagError instanceof Error ? tagError.message : String(tagError);
		return { itemUpdatedButTagsFailed: true, tagErrorMessage: errorMessage };
	}

	return {};
}

/**
 * Fetches a single item by its ID for a given team, including related category, tags, entity, and notes.
 * Notes are ordered by creation date (descending).
 *
 * @param supabase - The Supabase client instance.
 * @param itemId - The ID of the item to be fetched.
 * @param teamId - The ID of the team whose item is to be fetched.
 * @returns A promise that resolves to the item details or null if not found/not owned.
 * @throws Throws an error if the fetch operation fails.
 */
export async function getItemByIdForTeam(
	supabase: SupabaseClient,
	itemId: string,
	teamId: string
): Promise<ItemDetail | null> {
	const { data, error } = await supabase
		.from('items')
		.select(
			`
      id,
      name,
      description,
      expiration,
      created_at,
      updated_at,
      user_id, 
      team_id,
      category: categories ( id, name ),
      entity: entities ( id, name, team_id ),
      tags: tags ( id, name, team_id ),
      entity_name_manual,
      item_notes ( id, note_text, created_at, updated_at, user_id ) 
    `
		)
		.eq('team_id', teamId)
		.eq('id', itemId)
		.maybeSingle();

	if (error) {
		console.error(`Error fetching item ${itemId} for team ${teamId}:`, error);
		throw error;
	}

	if (!data) {
		return null;
	}

	const itemDetail: ItemDetail = {
		...data,
		category: Array.isArray(data.category) ? data.category[0] || null : data.category || null,
		entity: Array.isArray(data.entity) ? data.entity[0] || null : data.entity || null,
		tags: (data.tags as Tag[]) || [],
		item_notes: (data.item_notes || []).sort(
			(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		)
	};

	return itemDetail;
}