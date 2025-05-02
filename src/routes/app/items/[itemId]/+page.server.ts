import { fail, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { error as svelteKitError } from '@sveltejs/kit';
import type { SupabaseClient, Session } from '@supabase/supabase-js';

// Reusable types (consider moving to a dedicated types file, e.g., src/lib/types.ts)
interface Entity {
    id: string;
    name: string;
    description: string | null;
}

interface ItemNote {
    id: string;
    note_text: string;
    created_at: string;
    updated_at: string;
    // user_id is implicitly handled by RLS
}

interface ItemWithRelations {
	id: string;
	name: string;
	description: string | null;
	expiration: string;
	created_at: string;
	updated_at: string;
	category: { id: string; name: string } | null;
	tags: { id: string; name: string }[];
    entity: { id: string; name: string } | null;
    entity_name_manual: string | null;
    item_notes: ItemNote[]; // Add notes relation
}

export const load: PageServerLoad = async ({ params, locals: { supabase, session } }) => {
	if (!session) {
		redirect(303, '/auth');
	}

    const itemId = params.itemId;

	// Fetch the specific item, ensuring it belongs to the user, joining relations including notes
	const { data: itemData, error: itemError } = await supabase
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
            item_notes ( id, note_text, created_at, updated_at ) 
          `
		)
		.eq('user_id', session.user.id)
        .eq('id', itemId)
		.maybeSingle(); // Expect one or null (if ID invalid or doesn't belong to user)

	if (itemError) {
		console.error('Error loading item:', itemError);
		svelteKitError(500, { message: `Could not load item details: ${itemError.message}` });
	}

    if (!itemData) {
        svelteKitError(404, { message: 'Item not found or you do not have permission to view it.'});
    }

    // Type assertion after fetching
    const item: ItemWithRelations = itemData as unknown as ItemWithRelations;
    // Ensure notes is always an array, ordered by creation date descending
    item.item_notes = (item.item_notes || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

	// Fetch categories and entities needed for the edit form
	const [categoriesResult, entitiesResult] = await Promise.all([
        supabase.from('categories').select('id, name').order('name'),
        supabase.from('entities').select('id, name, description').eq('user_id', session.user.id).order('name')
    ]);

    if (categoriesResult.error) {
         console.error('Error loading categories:', categoriesResult.error);
         // Handle error - form might lack categories
    }
    if (entitiesResult.error) {
         console.error('Error loading entities:', entitiesResult.error);
         // Handle error - form might lack entities
    }

    const categories: { id: string; name: string }[] = (categoriesResult.data as unknown as { id: string; name: string }[]) ?? [];
    const entities: Entity[] = (entitiesResult.data as unknown as Entity[]) ?? [];

	return {
		item: item, // Pass the single item
        categories: categories,
        entities: entities,
	};
};

export const actions: Actions = {

    // --- addNote Action ---
    addNote: async ({ request, params, locals }) => {
        const { supabase, session } = locals;
        if (!session) {
            return fail(401, { noteError: 'Unauthorized' });
        }
        const itemId = params.itemId;
        const formData = await request.formData();
        const noteText = formData.get('noteText') as string | null;

        if (!noteText || noteText.trim().length === 0) {
            return fail(400, { noteError: 'Note cannot be empty.', noteText });
        }

        // Fetch the item *again* within the action to verify ownership before adding note
        // This is a security measure in case the load function data could be stale or manipulated client-side
        const { data: itemOwnerCheck, error: checkError } = await supabase
            .from('items')
            .select('id') // Just need to know if it exists and matches user
            .eq('id', itemId)
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (checkError) {
             console.error('Error checking item ownership before adding note:', checkError);
             return fail(500, { noteError: 'Database error verifying item ownership.'});
        }

        if (!itemOwnerCheck) {
             return fail(404, { noteError: 'Item not found or you do not have permission to add notes to it.' });
        }

        // Insert the note
        const { error: insertError } = await supabase
            .from('item_notes')
            .insert({
                item_id: itemId,
                user_id: session.user.id, // Set user_id explicitly
                note_text: noteText.trim()
            });

        if (insertError) {
             console.error('Error adding note:', insertError);
            return fail(500, {
                noteError: `Database error adding note: ${insertError.message}`,
                noteText
            });
        }

        return { noteSuccess: 'Note added successfully.' };
        // Data will reload via enhance
    },

    // --- updateItem Action (Moved Here) ---
    updateItem: async ({ request, params, locals }) => {
        const { supabase, session } = locals;
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }
        const itemId = params.itemId;
        const formData = await request.formData();
        // const itemId = formData.get('itemId') as string | null; // No longer needed from form
        const name = formData.get('name') as string | null;
        const description = formData.get('description') as string | null;
        const categoryId = formData.get('categoryId') as string | null;
        const expiration = formData.get('expiration') as string | null;
        const tagsString = formData.get('tags') as string | null;
        const entityNameManualInput = formData.get('entityNameManual') as string | null;

        // --- Basic Validation ---
        if (!name || !expiration) {
            return fail(400, {
                message: 'Missing required fields: Name and Expiration Date are required.',
                values: { itemId, name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput }, // Keep itemId in values for form context
                isUpdate: true
            });
        }

        // --- Determine Entity ID and Manual Name (same logic as before) ---
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
                updated_at: new Date()
            })
            .match({ id: itemId, user_id: session.user.id });

        if (updateItemError) {
            console.error('Error updating item details:', updateItemError);
            return fail(500, {
                message: `Database error updating item: ${updateItemError.message}`,
                values: { itemId, name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput },
                isUpdate: true
            });
        }

        // --- 2. Handle Tag Updates (same logic as before) ---
        const newTagNames = 
            tagsString
                ?.split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0) ?? [];

        try {
            // Get current tags
             type CurrentItemTag = { tag_id: string; tags: { name: string } | null };
             const { data: currentItemTagsData, error: currentTagsError } = await supabase
                .from('item_tags')
                .select('tag_id, tags(name)')
                .eq('item_id', itemId);
            if (currentTagsError) throw currentTagsError;
            const currentTags = (currentItemTagsData as unknown as CurrentItemTag[]) || [];
            const currentTagNames = currentTags.map(ct => ct.tags?.name).filter(Boolean) as string[];
            const currentTagMap = new Map(currentTags.map(ct => [ct.tags?.name, ct.tag_id]).filter(entry => entry[0] && entry[1]) as [string, string][]);

            // Tags to Add
            const tagsToAddNames = newTagNames.filter(name => !currentTagMap.has(name));
            if (tagsToAddNames.length > 0) {
                 const { data: existingTagsToAdd, error: findTagsErr } = await supabase
                    .from('tags')
                    .select('id, name')
                    .eq('user_id', session.user.id)
                    .in('name', tagsToAddNames);
                if (findTagsErr) throw findTagsErr;
                const existingTagsToAddMap = new Map(existingTagsToAdd.map(t => [t.name, t.id]));
                let tagsToLinkIds = existingTagsToAdd.map(t => t.id);
                const tagsToCreateNames = tagsToAddNames.filter(name => !existingTagsToAddMap.has(name));
                if (tagsToCreateNames.length > 0) {
                    const { data: createdTags, error: createTagsErr } = await supabase
                        .from('tags')
                        .insert(tagsToCreateNames.map(name => ({ name, user_id: session.user.id })))
                        .select('id');
                    if (createTagsErr) throw createTagsErr;
                    tagsToLinkIds = tagsToLinkIds.concat(createdTags.map(t => t.id));
                }
                if (tagsToLinkIds.length > 0) {
                    const { error: linkTagsErr } = await supabase
                        .from('item_tags')
                        .insert(tagsToLinkIds.map(tagId => ({ item_id: itemId, tag_id: tagId })));
                    if (linkTagsErr) throw linkTagsErr;
                }
            }

            // Tags to Remove
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
    },

    // --- deleteNote Action ---
    deleteNote: async ({ request, params, locals }) => {
        const { supabase, session } = locals;
        if (!session) {
            return fail(401, { noteDeleteError: 'Unauthorized' });
        }

        const formData = await request.formData();
        const noteId = formData.get('noteId') as string | null;
        const itemId = params.itemId; // For context if needed, but RLS checks user_id on note

        if (!noteId) {
            return fail(400, { noteDeleteError: 'Missing note ID.' });
        }

        // Delete the note, ensuring it belongs to the current user via RLS
        // RLS Policy: DELETE ON item_notes FOR DELETE USING (auth.uid() = user_id)
        const { error } = await supabase
            .from('item_notes')
            .delete()
            .match({ id: noteId, user_id: session.user.id }); // Match user_id for defense-in-depth

        if (error) {
            console.error('Error deleting note:', error);
            return fail(500, {
                noteDeleteError: `Database error deleting note: ${error.message}`,
                errorNoteId: noteId // Pass back ID for potential UI feedback
            });
        }

        return { noteDeleteSuccess: 'Note deleted successfully.' };
    },

    // --- updateNote Action ---
    updateNote: async ({ request, params, locals }) => {
        const { supabase, session } = locals;
        if (!session) {
            return fail(401, { noteUpdateError: 'Unauthorized' });
        }

        const formData = await request.formData();
        const noteId = formData.get('noteId') as string | null;
        const noteText = formData.get('noteText') as string | null;
        const itemId = params.itemId; // Context

        // Validation
        if (!noteId) {
            return fail(400, { noteUpdateError: 'Missing note ID.', noteId, noteText });
        }
        if (!noteText || noteText.trim().length === 0) {
            return fail(400, { noteUpdateError: 'Note text cannot be empty.', noteId, noteText });
        }

        // Update the note, ensuring it belongs to the user via RLS + match
        // RLS Policy: UPDATE ON item_notes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
        const { error } = await supabase
            .from('item_notes')
            .update({
                note_text: noteText.trim(),
                // updated_at is handled by the database trigger (if created)
                // If no trigger: updated_at: new Date()
            })
            .match({ id: noteId, user_id: session.user.id });

        if (error) {
            console.error('Error updating note:', error);
            return fail(500, {
                noteUpdateError: `Database error updating note: ${error.message}`,
                errorNoteId: noteId,
                noteText // Return submitted text for repopulation
            });
        }

        return { noteUpdateSuccess: 'Note updated successfully.' };
    }
}; 