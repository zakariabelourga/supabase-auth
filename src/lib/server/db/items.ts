import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemEntry, ItemDetail, Tag } from '$lib/types'; // ItemDetail includes notes and more comprehensive relations
import { findOrCreateTagsForUser, linkTagsToItem, syncItemTags } from './tags';

// Define a more specific return type if possible, or adjust ItemWithRelations
// to accurately reflect what's being selected. For now, using ItemEntry for lists and ItemDetail for single item views.

/**
 * Fetches all items for a given user, including related category, tags, and entity.
 * Items are ordered by expiration date (ascending).
 *
 * @param supabase - The Supabase client instance.
 * @param userId - The ID of the user whose items are to be fetched.
 * @returns A promise that resolves to an array of items or throws an error.
 */
export async function listItemsForUser(
	supabase: SupabaseClient,
	userId: string
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
      category: categories ( id, name ),
      tags ( id, name ),
      entity: entities ( id, name ),
      entity_name_manual
    `
		)
		.eq('user_id', userId)
		.order('expiration', { ascending: true });

	if (error) {
		console.error('Error fetching items for user:', error);
		// Consider whether to throw a custom error or re-throw the Supabase error
		// For now, re-throwing to be handled by the caller.
		throw error;
	}

	// Map the raw data to the expected ItemEntry structure
	const mappedData: ItemEntry[] = (data || []).map((item) => ({
		...item,
		// Handle cases where Supabase returns a single object or an array for joined relations
		category: Array.isArray(item.category) ? item.category[0] || null : item.category || null,
		entity: Array.isArray(item.entity) ? item.entity[0] || null : item.entity || null,
		tags: item.tags || [] // Ensure tags is always an array (many-to-many)
	}));

	return mappedData;
}

// --- Helper function to resolve entity ---
async function _resolveEntity(
	supabase: SupabaseClient,
	userId: string,
	entityNameManual: string | null | undefined
): Promise<{ entityIdToSave: string | null; entityNameManualToSave: string | null }> {
	let entityIdToSave: string | null = null;
	let entityNameManualToSave: string | null = entityNameManual?.trim() || null;

	if (entityNameManualToSave) {
		// Server-side check: If a manual name was provided, see if it EXACTLY matches an existing entity for this user
		const { data: matchingEntity, error: entityCheckError } = await supabase
			.from('entities')
			.select('id')
			.eq('user_id', userId)
			.eq('name', entityNameManualToSave) // Case-sensitive match
			.maybeSingle();

		if (entityCheckError) {
			console.error('Error checking for existing entity:', entityCheckError);
			// Depending on strictness, this could throw. For now, log and proceed.
			// Consider how to handle this error more robustly if needed.
		}

		if (matchingEntity) {
			entityIdToSave = matchingEntity.id;
			entityNameManualToSave = null; // Clear manual name if a match is found
		}
	}
	return { entityIdToSave, entityNameManualToSave };
}

// Define the structure for the data needed to create an item
export interface CreateItemPayload {
	userId: string;
	name: string;
	description: string | null;
	categoryId: string | null;
	expiration: string; // Assuming string in 'YYYY-MM-DD' format
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
	const { userId, name, description, categoryId, expiration, tagsString, entityNameManual } =
		itemData;

	// --- 1. Determine Entity ID and Manual Name ---
	const { entityIdToSave, entityNameManualToSave } = await _resolveEntity(
		supabase,
		userId,
		entityNameManual
	);

	// --- 2. Insert the Item ---
	const { data: newItemData, error: insertError } = await supabase
		.from('items')
		.insert({
			name: name,
			description: description,
			category_id: categoryId || null,
			expiration: expiration,
			user_id: userId,
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

	// --- 3. Handle Tags using Tag Service ---
	const tagNames =
		tagsString
			?.split(',')
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0) ?? [];

	if (tagNames.length > 0) {
		try {
			const tagIds = await findOrCreateTagsForUser(supabase, userId, tagNames);
			if (tagIds.length > 0) {
				await linkTagsToItem(supabase, newItemId, tagIds);
			}
		} catch (tagError: unknown) {
			console.error('Error handling tags for new item via service:', tagError);
			const errorMessage = tagError instanceof Error ? tagError.message : String(tagError);
			// Item was added, but tags failed. Return this info to the caller.
			return { id: newItemId, itemAddedButTagsFailed: true, tagErrorMessage: errorMessage };
		}
	}

	return { id: newItemId };
}

/**
 * Deletes an item by its ID, ensuring it belongs to the specified user.
 *
 * @param supabase The Supabase client instance.
 * @param itemId The ID of the item to delete.
 * @param userId The ID of the user who owns the item.
 * @throws Throws an error if the deletion fails or if the item is not found for the user.
 */
export async function deleteItemById(
	supabase: SupabaseClient,
	itemId: string,
	userId: string
): Promise<void> {
	const { error, count } = await supabase
		.from('items')
		.delete()
		.match({ id: itemId, user_id: userId });

	if (error) {
		console.error('Error deleting item from database:', error);
		throw new Error(`Database error deleting item: ${error.message}`);
	}

	if (count === 0) {
		// This could happen if the item doesn't exist or doesn't belong to the user.
		console.warn(
			`Attempted to delete item ${itemId} for user ${userId}, but no matching item was found.`
		);
		throw new Error('Item not found or not owned by user.');
	}
	// ON DELETE CASCADE is set for item_tags.item_id, related tags will be handled by the DB.
}

/**
 * Fetches a single item by its ID for a given user, including related category, tags, entity, and notes.
 * Notes are ordered by creation date (descending).
 *
 * @param supabase - The Supabase client instance.
 * @param itemId - The ID of the item to be fetched.
 * @param userId - The ID of the user whose item is to be fetched.
 * @returns A promise that resolves to the item details or null if not found/not owned.
 * @throws Throws an error if the fetch operation fails.
 */
export async function getItemByIdForUser(
	supabase: SupabaseClient,
	itemId: string,
	userId: string
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
      category: categories ( id, name ),
      tags ( id, name ),
      entity: entities ( id, name ),
      entity_name_manual,
      item_notes ( id, note_text, created_at, updated_at, user_id ) 
    `
		)
		.eq('user_id', userId)
		.eq('id', itemId)
		.maybeSingle();

	if (error) {
		console.error(`Error fetching item ${itemId} for user ${userId}:`, error);
		throw error;
	}

	if (!data) {
		return null;
	}

	// Map the raw data to the expected ItemDetail structure
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

// Define the structure for the data needed to update an item
export interface UpdateItemPayload {
	itemId: string;
	userId: string;
	name: string;
	description: string | null;
	categoryId: string | null;
	expiration: string;
	tagsString: string | null;
	entityNameManual: string | null;
	// entityId could be added if direct selection is allowed
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
		userId,
		name,
		description,
		categoryId,
		expiration,
		tagsString,
		entityNameManual
	} = itemData;

	// --- 1. Determine Entity ID and Manual Name ---
	const { entityIdToSave, entityNameManualToSave } = await _resolveEntity(
		supabase,
		userId,
		entityNameManual
	);

	// --- 2. Update Core Item Details ---
	const { error: updateItemError } = await supabase
		.from('items')
		.update({
			name: name,
			description: description,
			category_id: categoryId || null,
			expiration: expiration,
			entity_id: entityIdToSave,
			entity_name_manual: entityNameManualToSave,
			updated_at: new Date().toISOString()
		})
		.match({ id: itemId, user_id: userId });

	if (updateItemError) {
		console.error('Error updating item details in database:', updateItemError);
		throw new Error(`Database error updating item: ${updateItemError.message}`);
	}

	// --- 3. Handle Tag Updates using Tag Service ---
	const newTagNames =
		tagsString
			?.split(',')
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0) ?? [];

	try {
		await syncItemTags(supabase, itemId, userId, newTagNames);
	} catch (tagError: unknown) {
		console.error('Error updating tags for item via service:', tagError);
		// Item was updated, but tags failed. Return this info to the caller.
		const errorMessage = tagError instanceof Error ? tagError.message : String(tagError);
		return { itemUpdatedButTagsFailed: true, tagErrorMessage: errorMessage };
	}

	return {}; // Success
}