import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { error as svelteKitError } from '@sveltejs/kit';
import type { AuthenticatedEvent, Entity, ItemEntry as ItemWithRelations, Category } from '$lib/types';
import { listItemsForUser, createItem, type CreateItemPayload, deleteItemById } from '$lib/server/db/items';
import { getAllCategories } from '$lib/server/db/categories';
import { getEntitiesForUser } from '$lib/server/db/entities';

export const load: PageServerLoad = async ({ locals: { supabase, session } }) => {
	if (!session) {
		redirect(303, '/');
	}

	try {
		// Fetch data in parallel
		const [items, categories, entities] = await Promise.all([
			listItemsForUser(supabase, session.user.id),
			getAllCategories(supabase),
			getEntitiesForUser(supabase, session.user.id)
		]);

		// No need to process items further if listItemsForUser already returns them correctly typed
		return {
			items: items,
			categories: categories,
			entities: entities,
			streamed: {}
		};

	} catch (error: any) {
		console.error('Error in load function:', error);
		// Handle errors from listItemsForUser or other awaited promises
		svelteKitError(500, { message: error.message || 'An unexpected error occurred while loading page data.' });
		// SvelteKit will automatically return a 500 error page, 
		// so no explicit return needed here in the catch block if you throw.
		// If you want to return specific error data to the page, you could do that here too.
		// For now, throwing the error is fine as SvelteKit handles it.
		throw error; // Re-throw to let SvelteKit handle the error page rendering
	}
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
		const entityNameManualInput = formData.get('entityNameManual') as string | null;
		// const entityIdInput = formData.get('entityId') as string | null; // Not used by createItem directly yet

		// --- Basic Validation (can remain here or be part of createItem if preferred) ---
		if (!name || !expiration) {
			return fail(400, {
				message: 'Missing required fields: Name and Expiration Date are required.',
				values: { name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput }
			});
		}

		const itemPayload: CreateItemPayload = {
			userId: session.user.id,
			name,
			description,
			categoryId,
			expiration,
			tagsString,
			entityNameManual: entityNameManualInput
		};

		try {
			const result = await createItem(supabase, itemPayload);

			if (result.itemAddedButTagsFailed) {
				return fail(500, { // Or a 207 Multi-Status if you want to be more specific
					message: `Item added (ID: ${result.id}), but failed to process tags: ${result.tagErrorMessage}`,
					values: { name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput },
					itemAddedButTagsFailed: true
				});
			}

			// --- Success ---
			return {
				status: 201, // 201 Created
				message: 'Item added successfully.',
				itemId: result.id // Optionally return the new item ID
			};

		} catch (error: any) {
			console.error('Error calling createItem:', error);
			return fail(500, {
				message: error.message || 'An unexpected error occurred while adding the item.',
				values: { name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput }
			});
		}
	},

    deleteItem: async ({ request, locals: { supabase, session } }: AuthenticatedEvent) => {
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();
        const itemId = formData.get('itemId') as string | null;

        if (!itemId) {
            return fail(400, { message: 'Missing item ID.', deleteErrorId: null });
        }

        try {
            await deleteItemById(supabase, itemId, session.user.id);
            
            // Success - enhance handles UI update by reloading data (usually)
            return { 
                status: 200,
                message: 'Item deleted successfully.',
                deletedItemId: itemId // For client-side UI updates if needed
            };        
        } catch (error: any) {
            console.error('Error calling deleteItemById:', error);
            return fail(500, {
                message: error.message || 'An unexpected error occurred while deleting the item.',
                deleteErrorId: itemId // Pass back ID for potential UI feedback
            });
        }
    }
};