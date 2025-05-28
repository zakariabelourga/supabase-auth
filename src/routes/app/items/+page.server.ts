import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { error as svelteKitError } from '@sveltejs/kit';
import type { Entity, ItemEntry as ItemWithRelations, Category, ActiveTeam } from '$lib/types'; 
import { listItemsForTeam, createItem, type CreateItemPayload, deleteItemById } from '$lib/server/db/items'; 
import { getAllCategories } from '$lib/server/db/categories';
import { getEntitiesForTeam } from '$lib/server/db/entities'; 

export const load: PageServerLoad = async (event) => {
	const { locals: { supabase, session, activeTeam } } = event; 
	if (!session) {
		redirect(303, '/');
	}

	if (!activeTeam?.id) {
		console.warn('No active team found for user, redirecting.');
		redirect(303, '/app/teams?notice=no-active-team'); 
	}

	try {
		const [items, categories, entities] = await Promise.all([
			listItemsForTeam(supabase, activeTeam.id),
			getAllCategories(supabase),
			getEntitiesForTeam(supabase, activeTeam.id)
		]);

		return {
			items: items as ItemWithRelations[], 
			categories: categories as Category[],
			entities: entities as Entity[],
			streamed: {}
		};

	} catch (error: any) {
		console.error('Error in load function (items page):', error);
		svelteKitError(500, { message: error.message || 'An unexpected error occurred while loading page data.' });
		throw error; 
	}
};

export const actions: Actions = {
	addItem: async (event) => {
		const { request, locals: { supabase, session, activeTeam } } = event;
		if (!session) {
			return fail(401, { message: 'Unauthorized' });
		}

		if (!activeTeam?.id) {
			return fail(400, { message: 'No active team selected. Please select or create a team.' });
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
				message: 'Missing required fields: Name and Expiration Date are required.',
				values: { name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput }
			});
		}

		const itemPayload: CreateItemPayload = {
			teamId: activeTeam.id, 
			creatorUserId: session.user.id, 
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
				return fail(500, { 
					message: `Item added (ID: ${result.id}), but failed to process tags: ${result.tagErrorMessage}`,
					values: { name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput },
					itemAddedButTagsFailed: true
				});
			}

			return {
				status: 201, 
				message: 'Item added successfully.',
				itemId: result.id 
			};

		} catch (error: any) {
			console.error('Error calling createItem:', error);
			return fail(500, {
				message: error.message || 'An unexpected error occurred while adding the item.',
				values: { name, description, categoryId, expiration, tagsString, entityNameManual: entityNameManualInput }
			});
		}
	},

    deleteItem: async (event) => {
        const { request, locals: { supabase, session, activeTeam } } = event;
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

		if (!activeTeam?.id) {
			return fail(400, { message: 'No active team selected. Cannot delete item.' });
		}

        const formData = await request.formData();
        const itemId = formData.get('itemId') as string | null;

        if (!itemId) {
            return fail(400, { message: 'Missing item ID.', deleteErrorId: null });
        }

        try {
            await deleteItemById(supabase, itemId, activeTeam.id);
            
            return { 
                status: 200,
                message: 'Item deleted successfully.',
                deletedItemId: itemId 
            };        
        } catch (error: any) {
            console.error('Error calling deleteItemById:', error);
            return fail(500, {
                message: error.message || 'An unexpected error occurred while deleting the item.',
                deleteErrorId: itemId 
            });
        }
    }
};