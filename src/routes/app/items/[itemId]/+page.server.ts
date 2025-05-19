import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { error as svelteKitError } from '@sveltejs/kit';
import type { Entity, ItemDetail, Category } from '$lib/types';
import { getItemByIdForUser, updateItemWithRelations, type UpdateItemPayload } from '$lib/server/db/items';
import { addNoteToItem, deleteNoteById, updateNoteById } from '$lib/server/db/notes';
import { getEntitiesForUser } from '$lib/server/db/entities';
import { getAllCategories } from '$lib/server/db/categories';

// Define PageData type based on load function
export type PageData = {
	item: ItemDetail;
	categories: Category[];
	entities: Entity[];
};

export const load: PageServerLoad<PageData> = async ({ params, locals: { supabase, session } }) => {
	if (!session) {
		redirect(303, '/auth');
	}

    const itemId = params.itemId;

	if (!itemId) {
		svelteKitError(400, { message: 'Item ID is missing from parameters.' });
	}

	// Fetch the specific item using the new database function
	let item: ItemDetail | null = null;
	let itemError: Error | null = null;
	try {
		item = await getItemByIdForUser(supabase, itemId, session.user.id);
	} catch (e) {
		itemError = e instanceof Error ? e : new Error('Failed to load item details');
	}

	if (itemError) {
		console.error('Error loading item:', itemError.message);
		svelteKitError(500, { message: `Could not load item details: ${itemError.message}` });
	}

    if (!item) {
        svelteKitError(404, { message: 'Item not found or you do not have permission to view it.'});
    }
    // item_notes are already sorted by getItemByIdForUser

	// Fetch categories and entities needed for the edit form
	let categories: Category[] = [];
	let entities: Entity[] = [];
	try {
		categories = await getAllCategories(supabase);
		entities = await getEntitiesForUser(supabase, session.user.id);
	} catch (err: any) {
		console.error('Error loading categories or entities:', err.message);
		// Not throwing svelteKitError here to allow page to load with partial data if one fails
		// The form will indicate if data is missing.
	}

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

        if (!itemId) {
            return fail(400, { noteError: 'Item ID is missing from parameters.' });
        }
        const formData = await request.formData();
        const noteText = formData.get('noteText') as string | null;

        if (!noteText || noteText.trim().length === 0) {
            return fail(400, { noteError: 'Note cannot be empty.', noteText });
        }

        try {
            await addNoteToItem(supabase, itemId, session.user.id, noteText.trim());
        } catch (error: any) {
            console.error('Error adding note:', error);
            return fail(error.message.includes('not found or you do not have permission') ? 404 : 500, {
                noteError: `Error adding note: ${error.message}`,
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

        if (!itemId) {
            return fail(400, { message: 'Item ID is missing from parameters.' });
        }
        const formData = await request.formData();
        // const itemId = params.itemId; // Already available via params
        const name = formData.get('name') as string | null;
        const description = formData.get('description') as string | null;
        const categoryId = formData.get('categoryId') as string | null;
        const expiration = formData.get('expiration') as string | null;
        const tagsString = formData.get('tags') as string | null;
        const entityNameManualInput = formData.get('entityNameManual') as string | null;

        // --- Basic Validation ---
        if (!name || !expiration) {
            return fail(400, {
                itemUpdateError: 'Missing required fields: Name and Expiration Date are required.',
                values: { itemId, name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput }, // Keep itemId in values for form context
                isUpdate: true
            });
        }

        const updatePayload: UpdateItemPayload = {
            itemId,
            userId: session.user.id,
            name,
            description,
            categoryId,
            expiration,
            tagsString,
            entityNameManual: entityNameManualInput
        };

        try {
            const result = await updateItemWithRelations(supabase, updatePayload);
            if (result.itemUpdatedButTagsFailed) {
                return fail(500, {
                    itemUpdateError: `Item updated, but failed to process tags: ${result.tagErrorMessage}`,
                    values: { itemId, name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput },
                    isUpdate: true,
                    itemUpdatedButTagsFailed: true
                });
            }
        } catch (error: any) {
            console.error('Error updating item:', error);
            return fail(500, {
                itemUpdateError: `Database error updating item: ${error.message}`,
                values: { itemId, name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput },
                isUpdate: true
            });
        }

        // --- Success ---
        return { 
            itemUpdateSuccess: true,
            message: 'Item updated successfully.'
        };
    },

    // --- deleteNote Action ---
    deleteNote: async ({ request, locals }) => {
        const { supabase, session } = locals;
        if (!session) {
            return fail(401, { noteDeleteError: 'Unauthorized' });
        }

        const formData = await request.formData();
        const noteId = formData.get('noteId') as string | null;

        if (!noteId) {
            return fail(400, { noteDeleteError: 'Missing note ID.' });
        }

        try {
            await deleteNoteById(supabase, noteId, session.user.id);
        } catch (error: any) {
            console.error('Error deleting note:', error);
            return fail(500, {
                noteDeleteError: `Error deleting note: ${error.message}`,
                errorNoteId: noteId
            });
        }

        return { noteDeleteSuccess: 'Note deleted successfully.' };
    },

    // --- updateNote Action ---
    updateNote: async ({ request, locals }) => {
        const { supabase, session } = locals;
        if (!session) {
            return fail(401, { noteUpdateError: 'Unauthorized' });
        }

        const formData = await request.formData();
        const noteId = formData.get('noteId') as string | null;
        const noteText = formData.get('noteText') as string | null;

        // Validation
        if (!noteId) {
            return fail(400, { noteUpdateError: 'Missing note ID.', noteId, noteText });
        }
        if (!noteText || noteText.trim().length === 0) {
            return fail(400, { noteUpdateError: 'Note text cannot be empty.', noteId, noteText });
        }

        try {
            await updateNoteById(supabase, noteId, session.user.id, noteText.trim());
        } catch (error: any) {
            console.error('Error updating note:', error);
            return fail(500, {
                noteUpdateError: `Error updating note: ${error.message}`,
                errorNoteId: noteId,
                noteText
            });
        }

        return { noteUpdateSuccess: 'Note updated successfully.' };
    }
};