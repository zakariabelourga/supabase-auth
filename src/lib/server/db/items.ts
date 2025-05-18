import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemEntry, ItemDetail, Tag } from '$lib/types'; // ItemDetail includes notes and more comprehensive relations

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
		console.warn(
			`Attempted to delete item ${itemId} for user ${userId}, but no matching item was found.`
		);
		// Optionally throw a more specific error, e.g., new Error('Item not found or not owned by user.');
		// For now, if no error from Supabase and count is 0, we consider it a non-failure from a DB perspective,
		// but the action handler might still want to know no rows were affected.
	}
	// If ON DELETE CASCADE is set for item_tags.item_id, related tags will be handled by the DB.
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
		tags: (data.tags as Tag[]) || [], // Ensure tags is always an array
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
	let entityIdToSave: string | null = null;
	let entityNameManualToSave: string | null = entityNameManual?.trim() || null;

	if (entityNameManualToSave) {
		const { data: matchingEntity, error: entityCheckError } = await supabase
			.from('entities')
			.select('id')
			.eq('user_id', userId)
			.eq('name', entityNameManualToSave)
			.maybeSingle();

		if (entityCheckError) {
			console.error('Error checking for existing entity during update:', entityCheckError);
			// Depending on strictness, this could throw. For now, log and proceed.
		}

		if (matchingEntity) {
			entityIdToSave = matchingEntity.id;
			entityNameManualToSave = null;
		}
	}

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

	// --- 3. Handle Tag Updates ---
	const newTagNames =
		tagsString
			?.split(',')
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0) ?? [];

	try {
		// Get current tags associated with the item
		const { data: currentItemTagsData, error: currentTagsError } = await supabase
			.from('item_tags')
			.select('tag_id, tags(id, name)') // Select tag name via relation
			.eq('item_id', itemId);

		if (currentTagsError) throw currentTagsError;

		// Process currentItemTagsData to align with the expected structure for tags
		const currentTagsProcessed: { tag_id: string; tags: { id: string; name: string } | null }[] = (
			currentItemTagsData || []
		).map((itemTag) => ({
			tag_id: itemTag.tag_id,
			tags: Array.isArray(itemTag.tags) ? itemTag.tags[0] || null : itemTag.tags || null
		}));

		const currentTagMap = new Map(
			currentTagsProcessed
				.map((ct) => (ct.tags ? [ct.tags.name, ct.tags.id] : null))
				.filter(Boolean) as [string, string][]
		);
		const currentTagNames = currentTagsProcessed
			.map((ct) => ct.tags?.name)
			.filter(Boolean) as string[];

		// Tags to Add: new tags not in currentTagNames
		const tagsToAddNames = newTagNames.filter((name) => !currentTagMap.has(name));
		if (tagsToAddNames.length > 0) {
			// Find if these tags already exist for the user
			const { data: existingUserTags, error: findTagsErr } = await supabase
				.from('tags')
				.select('id, name')
				.eq('user_id', userId)
				.in('name', tagsToAddNames);
			if (findTagsErr) throw findTagsErr;

			const existingUserTagMap = new Map(existingUserTags.map((t) => [t.name, t.id]));
			let tagsToLinkIds = existingUserTags.map((t) => t.id);

			// Identify tags that need to be created
			const tagsToCreateNames = tagsToAddNames.filter((name) => !existingUserTagMap.has(name));
			if (tagsToCreateNames.length > 0) {
				const { data: createdTags, error: createTagsErr } = await supabase
					.from('tags')
					.insert(tagsToCreateNames.map((name) => ({ name, user_id: userId })))
					.select('id');
				if (createTagsErr) throw createTagsErr;
				tagsToLinkIds = tagsToLinkIds.concat(createdTags.map((t) => t.id));
			}

			// Link new/existing tags to the item
			if (tagsToLinkIds.length > 0) {
				const { error: linkTagsErr } = await supabase
					.from('item_tags')
					.insert(tagsToLinkIds.map((tagId) => ({ item_id: itemId, tag_id: tagId })));
				if (linkTagsErr) throw linkTagsErr;
			}
		}

		// Tags to Remove: current tags not in newTagNames
		const tagsToRemoveNames = currentTagNames.filter((name) => !newTagNames.includes(name));
		const tagsToRemoveIds = tagsToRemoveNames
			.map((name) => currentTagMap.get(name))
			.filter(Boolean) as string[];

		if (tagsToRemoveIds.length > 0) {
			const { error: unlinkTagsErr } = await supabase
				.from('item_tags')
				.delete()
				.eq('item_id', itemId)
				.in('tag_id', tagsToRemoveIds);
			if (unlinkTagsErr) throw unlinkTagsErr;
		}
	} catch (tagError: unknown) {
		console.error('Error updating tags for item:', tagError);
		const errorMessage = tagError instanceof Error ? tagError.message : String(tagError);
		return { itemUpdatedButTagsFailed: true, tagErrorMessage: errorMessage };
	}

	return {}; // Success
}
