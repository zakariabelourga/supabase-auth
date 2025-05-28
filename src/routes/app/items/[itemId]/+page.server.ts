import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { error as svelteKitError } from '@sveltejs/kit';
import type { Entity, ItemDetail, Category, ActiveTeam } from '$lib/types'; 
import { getItemByIdForTeam, updateItemWithRelations, type UpdateItemPayload } from '$lib/server/db/items'; 
import { addNoteToItem, deleteNoteById, updateNoteById } from '$lib/server/db/notes';
import { getEntitiesForTeam } from '$lib/server/db/entities'; 
import { getAllCategories } from '$lib/server/db/categories';

// Define PageData type based on load function
export type PageData = {
	item: ItemDetail;
	categories: Category[];
	entities: Entity[];
};

export const load: PageServerLoad<PageData> = async ({ params, locals: { supabase, session, activeTeam } }) => {
	if (!session) {
		redirect(303, '/auth');
	}

	if (!activeTeam?.id) {
		console.warn('No active team found for user on item detail page, redirecting.');
		redirect(303, '/app/teams?notice=no-active-team');
	}

    const itemId = params.itemId;

	if (!itemId) {
		svelteKitError(400, { message: 'Item ID is missing from parameters.' });
	}

	let item: ItemDetail | null = null;
	let itemError: Error | null = null;
	try {
		// Fetch the specific item using teamId
		item = await getItemByIdForTeam(supabase, itemId, activeTeam.id);
	} catch (e) {
		itemError = e instanceof Error ? e : new Error('Failed to load item details');
	}

	if (itemError) {
		console.error('Error loading item:', itemError.message);
		svelteKitError(500, { message: `Could not load item details: ${itemError.message}` });
	}

    if (!item) {
        svelteKitError(404, { message: 'Item not found in this team or you do not have permission to view it.'});
    }

	let categories: Category[] = [];
	let entities: Entity[] = [];
	try {
		categories = await getAllCategories(supabase);
		// Fetch entities for the active team
		entities = await getEntitiesForTeam(supabase, activeTeam.id);
	} catch (err: any) {
		console.error('Error loading categories or entities:', err.message);
	}

	return {
		item: item!,
        categories: categories,
        entities: entities,
	};
};

export const actions: Actions = {

    addNote: async ({ request, params, locals }) => {
        const { supabase, session, activeTeam } = locals;
        if (!session) {
            return fail(401, { noteError: 'Unauthorized' });
        }
        if (!activeTeam?.id) {
            return fail(400, { noteError: 'No active team selected.' });
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
            // Pass activeTeam.id and session.user.id as authorUserId
            await addNoteToItem(supabase, itemId, activeTeam.id, session.user.id, noteText.trim());
        } catch (error: any) {
            console.error('Error adding note:', error);
            return fail(error.message.includes('not found in the specified team') ? 404 : 500, {
                noteError: `Error adding note: ${error.message}`,
                noteText
            });
        }

        return { noteSuccess: 'Note added successfully.' };
    },

    updateItem: async ({ request, params, locals }) => {
        const { supabase, session, activeTeam } = locals;
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }
        if (!activeTeam?.id) {
            return fail(400, { itemUpdateError: 'No active team selected.' });
        }
        const itemId = params.itemId;

        if (!itemId) {
            return fail(400, { message: 'Item ID is missing from parameters.' });
        }
        const formData = await request.formData();
        const name = formData.get('name') as string | null;
        const description = formData.get('description') as string | null;
        const categoryId = formData.get('categoryId') as string | null;
        const expiration = formData.get('expiration') as string | null;
        const tagsString = formData.get('tags') as string | null;
        const entityNameManualInput = formData.get('entityNameManual') as string | null;

        if (!name || !expiration) {
            return fail(400, {
                itemUpdateError: 'Missing required fields: Name and Expiration Date are required.',
                values: { itemId, name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput },
                isUpdate: true
            });
        }

        const updatePayload: UpdateItemPayload = {
            itemId,
            teamId: activeTeam.id, // Add teamId
            modifierUserId: session.user.id, // Add modifierUserId
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

        return { 
            itemUpdateSuccess: true,
            message: 'Item updated successfully.'
        };
    },

    deleteNote: async ({ request, locals }) => {
        const { supabase, session, activeTeam } = locals;
        if (!session) {
            return fail(401, { noteDeleteError: 'Unauthorized' });
        }
        if (!activeTeam?.id) {
            // Although deleteNoteById doesn't take teamId, ensure team context exists for the page.
            return fail(400, { noteDeleteError: 'No active team selected.' });
        }

        const formData = await request.formData();
        const noteId = formData.get('noteId') as string | null;

        if (!noteId) {
            return fail(400, { noteDeleteError: 'Missing note ID.' });
        }

        try {
            // deleteNoteById uses session.user.id to ensure the user owns the note
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

    updateNote: async ({ request, locals }) => {
        const { supabase, session, activeTeam } = locals;
        if (!session) {
            return fail(401, { noteUpdateError: 'Unauthorized' });
        }
        if (!activeTeam?.id) {
            // Ensure team context exists for the page.
            return fail(400, { noteUpdateError: 'No active team selected.' });
        }

        const formData = await request.formData();
        const noteId = formData.get('noteId') as string | null;
        const noteText = formData.get('noteText') as string | null;

        if (!noteId) {
            return fail(400, { noteUpdateError: 'Missing note ID.' });
        }
        if (!noteText || noteText.trim().length === 0) {
            return fail(400, { noteUpdateError: 'Note text cannot be empty.', errorNoteId: noteId, noteText });
        }

        try {
            // updateNoteById uses session.user.id to ensure the user owns the note
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