import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { error as svelteKitError } from '@sveltejs/kit';
import type { SupabaseClient, Session } from '@supabase/supabase-js';

// Define a type for the event object enriched by hooks
type AuthenticatedEvent = {
	locals: {
		supabase: SupabaseClient;
		session: Session | null;
	};
	request: Request;
	params: Partial<Record<string, string>>;
};

// Define the structure of an entity
interface Entity {
    id: string;
    name: string;
    description: string | null; // Add other fields if needed
}

// Define the structure of an item with its relations
interface ItemWithRelations {
	id: string;
	name: string;
	description: string | null;
	expiration: string; // Stored as date, retrieved as string
	created_at: string;
	updated_at: string;
	category: { id: string; name: string } | null;
	tags: { id: string; name: string }[];
    entity: { id: string; name: string } | null; // Linked entity
    entity_name_manual: string | null; // Manually entered name
}

export const load: PageServerLoad = async ({ locals: { supabase, session } }) => {
	if (!session) {
		redirect(303, '/');
	}

	// Fetch items, joining with categories, tags, and entities
	const { data: itemsData, error: itemsError } = await supabase
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
		.eq('user_id', session.user.id)
		.order('expiration', { ascending: true });

	const items: ItemWithRelations[] = (itemsData as unknown as ItemWithRelations[]) ?? [];

	if (itemsError) {
		console.error('Error loading items:', itemsError);
		svelteKitError(500, { message: `Could not load items: ${itemsError.message}` });
	}

	// Fetch all categories
	const { data: categoriesData, error: categoriesError } = await supabase
		.from('categories')
		.select('id, name')
		.order('name');
	const categories: { id: string; name: string }[] = (categoriesData as unknown as { id: string; name: string }[]) ?? [];

	if (categoriesError) {
		console.error('Error loading categories:', categoriesError);
		// Handle error
	}

    // Fetch user's entities for the dropdown/datalist
    const { data: entitiesData, error: entitiesError } = await supabase
        .from('entities')
        .select('id, name, description')
        .eq('user_id', session.user.id)
        .order('name');
    
    const entities: Entity[] = (entitiesData as unknown as Entity[]) ?? [];

    if (entitiesError) {
        console.error('Error loading entities:', entitiesError);
        // Handle error - form might not have entity selection
    }

	// Process items (ensure tags is array - already handled by type)
	const processedItems = items.map((item) => ({ ...item }));

	return {
		items: processedItems,
		categories: categories,
        entities: entities,
		streamed: {}
	};
};

export const actions: Actions = {
	addItem: async ({ request, locals: { supabase, session } }: AuthenticatedEvent) => {
		if (!session) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string | null;
		const description = formData.get('description') as string | null;
		const categoryId = formData.get('categoryId') as string | null;
		const expiration = formData.get('expiration') as string | null;
		const tagsString = formData.get('tags') as string | null;
        // Get potential entity ID from selection and manual name from input
        const entityIdInput = formData.get('entityId') as string | null; // Might come from a hidden input later
        const entityNameManualInput = formData.get('entityNameManual') as string | null; // From the text input

		// --- Basic Validation ---
		if (!name || !expiration) {
			return fail(400, {
				message: 'Missing required fields: Name and Expiration Date are required.',
				values: { name, description, categoryId, expiration, tagsString, entityId: entityIdInput, entityNameManual: entityNameManualInput }
			});
		}

        // --- Determine Entity ID and Manual Name --- 
        let entityIdToSave: string | null = null;
        let entityNameManualToSave: string | null = entityNameManualInput?.trim() || null;

        // Server-side check: If a manual name was provided, see if it EXACTLY matches an existing entity for this user
        if (entityNameManualToSave) {
            const { data: matchingEntity, error: entityCheckError } = await supabase
                .from('entities')
                .select('id')
                .eq('user_id', session.user.id)
                .eq('name', entityNameManualToSave) // Case-sensitive match
                .maybeSingle(); // Expect 0 or 1
            
            if (entityCheckError) {
                 console.error('Error checking for existing entity:', entityCheckError);
                 // Decide how to handle - fail or proceed with manual name?
                 // Let's proceed with manual name for now but log the error.
            }

            if (matchingEntity) {
                // Match found! Use the existing entity ID and clear the manual name.
                entityIdToSave = matchingEntity.id;
                entityNameManualToSave = null;
            }
        }
        // If entityIdInput was provided (e.g. from future JS enhancement) it could be used here,
        // potentially overriding the name lookup. For now, we rely on the name matching.

		// --- 1. Insert the Item ---
		const { data: newItemData, error: insertError } = await supabase
			.from('items')
			.insert({
				name: name,
				description: description,
				category_id: categoryId || null,
				expiration: expiration,
				user_id: session.user.id,
                entity_id: entityIdToSave, // Save the determined entity ID (or null)
                entity_name_manual: entityNameManualToSave // Save the manual name (or null)
			})
			.select('id')
			.single();

		if (insertError || !newItemData) {
			console.error('Error adding item:', insertError);
			return fail(500, {
				message: `Database error adding item: ${insertError?.message ?? 'Unknown error'}`,
				values: { name, description, categoryId, expiration, tagsString, entityId: entityIdInput, entityNameManual: entityNameManualInput }
			});
		}

		const newItemId = newItemData.id;

		// --- 2. Handle Tags (Keep existing logic) ---
		const tagNames =
			tagsString
				?.split(',')
				.map((tag) => tag.trim())
				.filter((tag) => tag.length > 0) ?? [];

		let allTagIds: string[] = [];

		if (tagNames.length > 0) {
			try {
				// Find existing tags...
				const { data: existingTags, error: existingTagsError } = await supabase
					.from('tags')
					.select('id, name')
					.eq('user_id', session.user.id)
					.in('name', tagNames);
				if (existingTagsError) throw existingTagsError;
				const existingTagMap = new Map(existingTags.map((tag) => [tag.name, tag.id]));
				allTagIds = existingTags.map((tag) => tag.id);

				// Identify and insert new tags...
				const newTagNames = tagNames.filter((name) => !existingTagMap.has(name));
				if (newTagNames.length > 0) {
					const { data: insertedTags, error: insertTagsError } = await supabase
						.from('tags')
						.insert(newTagNames.map((name) => ({ name, user_id: session.user.id })))
						.select('id');
				if (insertTagsError) throw insertTagsError;
				allTagIds = allTagIds.concat(insertedTags.map((tag) => tag.id));
				}

				// Link item and tags...
				if (allTagIds.length > 0) {
					const { error: itemTagsError } = await supabase
						.from('item_tags')
						.insert(allTagIds.map((tagId) => ({ item_id: newItemId, tag_id: tagId })));
				if (itemTagsError) throw itemTagsError;
				}
			} catch (tagError: any) {
				console.error('Error handling tags:', tagError);
				return fail(500, {
					message: `Item added, but failed to process tags: ${tagError.message}`,
					values: { name, description, categoryId, expiration, tagsString, entityId: entityIdInput, entityNameManual: entityNameManualInput }, // Pass back entity inputs
					itemAddedButTagsFailed: true
				});
			}
		}

		// --- Success ---
		redirect(303, '/app/items');
	},

    deleteItem: async ({ request, locals: { supabase, session } }: AuthenticatedEvent) => {
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();
        const itemId = formData.get('itemId') as string | null;

        if (!itemId) {
            return fail(400, { message: 'Missing item ID.' });
        }

        // Delete the item, ensuring it belongs to the current user
        // Note: Related item_tags will be deleted automatically if ON DELETE CASCADE is set 
        // on the item_tags.item_id foreign key constraint.
        const { error } = await supabase
            .from('items')
            .delete()
            .match({ id: itemId, user_id: session.user.id }); // Match user ID!

        if (error) {
            console.error('Error deleting item:', error);
            return fail(500, {
                message: `Database error deleting item: ${error.message}`,
                deleteErrorId: itemId // Pass back ID for potential UI feedback
            });
        }

        // Success - enhance handles UI update by reloading data
        return { 
            status: 200, // OK
            message: 'Item deleted successfully.' 
        };
    },

    updateItem: async ({ request, locals: { supabase, session } }: AuthenticatedEvent) => {
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();
        const itemId = formData.get('itemId') as string | null;
        const name = formData.get('name') as string | null;
        const description = formData.get('description') as string | null;
        const categoryId = formData.get('categoryId') as string | null;
        const expiration = formData.get('expiration') as string | null;
        const tagsString = formData.get('tags') as string | null;
        const entityNameManualInput = formData.get('entityNameManual') as string | null;

        // --- Basic Validation ---
        if (!itemId) {
            return fail(400, { message: 'Missing item ID for update.', isUpdate: true });
        }
        if (!name || !expiration) {
            return fail(400, {
                message: 'Missing required fields: Name and Expiration Date are required.',
                values: { itemId, name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput },
                isUpdate: true
            });
        }

        // --- Determine Entity ID and Manual Name (same logic as addItem) ---
        let entityIdToSave: string | null = null;
        let entityNameManualToSave: string | null = entityNameManualInput?.trim() || null;

        if (entityNameManualToSave) {
            const { data: matchingEntity } = await supabase
                .from('entities')
                .select('id')
                .eq('user_id', session.user.id)
                .eq('name', entityNameManualToSave)
                .maybeSingle();
            
            if (matchingEntity) {
                entityIdToSave = matchingEntity.id;
                entityNameManualToSave = null;
            }
        }

        // --- 1. Update Core Item Details ---
        const { error: updateItemError } = await supabase
            .from('items')
            .update({
                name: name,
                description: description,
                category_id: categoryId || null,
                expiration: expiration,
                entity_id: entityIdToSave,
                entity_name_manual: entityNameManualToSave,
                updated_at: new Date() // Explicitly set updated_at
            })
            .match({ id: itemId, user_id: session.user.id }); // Ensure user owns item

        if (updateItemError) {
            console.error('Error updating item details:', updateItemError);
            return fail(500, {
                message: `Database error updating item: ${updateItemError.message}`,
                values: { itemId, name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput },
                isUpdate: true
            });
        }

        // --- 2. Handle Tag Updates ---
        const newTagNames = 
            tagsString
                ?.split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0) ?? [];

        try {
            // Get current tags for the item
            const { data: currentItemTagsData, error: currentTagsError } = await supabase
                .from('item_tags')
                .select('tag_id, tags(name)') // Select name via join
                .eq('item_id', itemId);

            if (currentTagsError) throw currentTagsError;
            
            // Explicitly type the fetched data with casting
            type CurrentItemTag = { tag_id: string; tags: { name: string } | null };
            const currentTags = (currentItemTagsData as unknown as CurrentItemTag[]) || [];
            
            const currentTagNames = currentTags.map(ct => ct.tags?.name).filter(Boolean) as string[];
            const currentTagMap = new Map(currentTags.map(ct => [ct.tags?.name, ct.tag_id]).filter(entry => entry[0] && entry[1]) as [string, string][]);

            // --- Tags to Add ---
            const tagsToAddNames = newTagNames.filter(name => !currentTagMap.has(name));
            if (tagsToAddNames.length > 0) {
                 // Find existing tags among the ones to add for this user
                 const { data: existingTagsToAdd, error: findTagsErr } = await supabase
                    .from('tags')
                    .select('id, name')
                    .eq('user_id', session.user.id)
                    .in('name', tagsToAddNames);
                if (findTagsErr) throw findTagsErr;

                const existingTagsToAddMap = new Map(existingTagsToAdd.map(t => [t.name, t.id]));
                let tagsToLinkIds = existingTagsToAdd.map(t => t.id);

                // Identify truly new tags to be created
                const tagsToCreateNames = tagsToAddNames.filter(name => !existingTagsToAddMap.has(name));
                if (tagsToCreateNames.length > 0) {
                    const { data: createdTags, error: createTagsErr } = await supabase
                        .from('tags')
                        .insert(tagsToCreateNames.map(name => ({ name, user_id: session.user.id })))
                        .select('id');
                    if (createTagsErr) throw createTagsErr;
                    tagsToLinkIds = tagsToLinkIds.concat(createdTags.map(t => t.id));
                }

                // Link the added tags
                if (tagsToLinkIds.length > 0) {
                    const { error: linkTagsErr } = await supabase
                        .from('item_tags')
                        .insert(tagsToLinkIds.map(tagId => ({ item_id: itemId, tag_id: tagId })));
                    if (linkTagsErr) throw linkTagsErr;
                }
            }

            // --- Tags to Remove ---
            const tagsToRemoveNames = currentTagNames.filter(name => !newTagNames.includes(name));
            const tagsToRemoveIds = tagsToRemoveNames.map(name => currentTagMap.get(name)).filter(Boolean) as string[];

            if (tagsToRemoveIds.length > 0) {
                const { error: unlinkTagsErr } = await supabase
                    .from('item_tags')
                    .delete()
                    .eq('item_id', itemId)
                    .in('tag_id', tagsToRemoveIds);
                if (unlinkTagsErr) throw unlinkTagsErr;
            }

        } catch (tagError: any) {
            console.error('Error updating tags:', tagError);
            // Return failure but indicate item details might have been updated
            return fail(500, {
                message: `Item updated, but failed to update tags: ${tagError.message}`,
                values: { itemId, name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput },
                isUpdate: true,
                itemUpdatedButTagsFailed: true
            });
        }

        // --- Success ---
        return { 
            status: 200, // OK
            message: 'Item updated successfully.'
        };
    }
}; 