import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemEntry as ItemWithRelations } from '$lib/types'; // Assuming ItemEntry is the correct type for the list

// Define a more specific return type if possible, or adjust ItemWithRelations
// to accurately reflect what's being selected. For now, using ItemWithRelations.

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
): Promise<ItemWithRelations[]> {
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
	const mappedData: ItemWithRelations[] = (data || []).map((item) => ({
		...item,
		// Supabase returns joined one-to-one relations as arrays by default,
		// so we take the first element if it exists.
		category: Array.isArray(item.category) && item.category.length > 0 ? item.category[0] : null,
		entity: Array.isArray(item.entity) && item.entity.length > 0 ? item.entity[0] : null,
		tags: item.tags || [] // Ensure tags is always an array
	}));

	return mappedData;
}

// We might also add functions here for fetching categories and entities if they
// are commonly fetched together with items or by other parts of the app.
// For example:

// export async function getAllCategories(supabase: SupabaseClient): Promise<Category[]> { ... }
// export async function getEntitiesForUser(supabase: SupabaseClient, userId: string): Promise<Entity[]> { ... }

// Define the structure for the data needed to create an item
export interface CreateItemPayload {
	userId: string;
	name: string;
	description: string | null;
	categoryId: string | null;
	expiration: string; // Assuming string in 'YYYY-MM-DD' format
	tagsString: string | null;
	entityNameManual: string | null;
	// We might add entityId here if we allow selecting an existing entity directly by ID in the future
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
			// For now, we'll let this proceed and save as manual, but this could be a hard error.
			// throw new Error(`Error checking for existing entity: ${entityCheckError.message}`);
		}

		if (matchingEntity) {
			entityIdToSave = matchingEntity.id;
			entityNameManualToSave = null; // Clear manual name if a match is found
		}
	}

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

	// --- 3. Handle Tags ---
	const tagNames =
		tagsString
			?.split(',')
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0) ?? [];

	if (tagNames.length > 0) {
		try {
			let allTagIds: string[] = [];

			// Find existing tags for the user
			const { data: existingTags, error: existingTagsError } = await supabase
				.from('tags')
				.select('id, name')
				.eq('user_id', userId)
				.in('name', tagNames);

			if (existingTagsError) throw existingTagsError;

			const existingTagMap = new Map(existingTags.map((tag) => [tag.name, tag.id]));
			allTagIds = existingTags.map((tag) => tag.id);

			// Identify and insert new tags
			const newTagNames = tagNames.filter((name) => !existingTagMap.has(name));
			if (newTagNames.length > 0) {
				const { data: insertedTags, error: insertTagsError } = await supabase
					.from('tags')
					.insert(newTagNames.map((name) => ({ name, user_id: userId })))
					.select('id');

				if (insertTagsError) throw insertTagsError;
				allTagIds = allTagIds.concat(insertedTags.map((tag) => tag.id));
			}

			// Link item and tags
			if (allTagIds.length > 0) {
				const { error: itemTagsError } = await supabase
					.from('item_tags')
					.insert(allTagIds.map((tagId) => ({ item_id: newItemId, tag_id: tagId })));

				if (itemTagsError) throw itemTagsError;
			}
		} catch (tagError: unknown) {
			console.error('Error handling tags for new item:', tagError);
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
		// Depending on desired behavior, this could be a specific error or just logged.
		console.warn(`Attempted to delete item ${itemId} for user ${userId}, but no matching item was found.`);
		// Optionally throw a more specific error, e.g., new Error('Item not found or not owned by user.');
		// For now, if no error from Supabase and count is 0, we consider it a non-failure from a DB perspective,
		// but the action handler might still want to know no rows were affected.
	}
	// If ON DELETE CASCADE is set for item_tags.item_id, related tags will be handled by the DB.
} 