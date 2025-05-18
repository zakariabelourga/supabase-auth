import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { error as svelteKitError } from '@sveltejs/kit';
import type { AuthenticatedEvent, Entity } from '$lib/types';
import { getEntitiesForUser, createEntity, updateEntity, deleteEntity } from '$lib/server/db/entities';

export const load: PageServerLoad = async ({ locals: { supabase, session } }) => {
	if (!session) {
		redirect(303, '/auth'); // Protect the page
	}

	let entities: Entity[] = [];
	try {
		entities = await getEntitiesForUser(supabase, session.user.id);
	} catch (error: any) {
		console.error('Error loading entities:', error);
		svelteKitError(500, { message: `Could not load entities: ${error.message}` });
	}

	return {
		entities: entities
	};
};

export const actions: Actions = {
	addEntity: async ({ request, locals: { supabase, session } }: AuthenticatedEvent) => {
		if (!session) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string | null;
		const description = formData.get('description') as string | null;

		// --- Basic Validation ---
		if (!name || name.trim().length === 0) {
			return fail(400, {
				message: 'Entity Name is required.',
				values: { name, description }
			});
		}

		const trimmedName = name.trim();

		try {
			await createEntity(supabase, session.user.id, {
				name: trimmedName,
				description: description?.trim() || null
			});
			return {
				status: 201, // Created
				message: `Entity "${trimmedName}" added successfully.`
			};
		} catch (error: any) {
			console.error('Error adding entity:', error);
			if (error.code === '23505') { // Unique constraint violation
				return fail(409, {
					message: `An entity with the name "${trimmedName}" already exists.`,
					values: { name, description }
				});
			}
			return fail(500, {
				message: `Database error adding entity: ${error.message}`,
				values: { name, description }
			});
		} 
        // No redirect needed if using enhance, the page data should update.
		// redirect(303, '/app/entities'); // Fallback if not using enhance
	},

    deleteEntity: async ({ request, locals: { supabase, session } }: AuthenticatedEvent) => {
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();
        const entityId = formData.get('entityId') as string | null;

        if (!entityId) {
            return fail(400, { message: 'Missing entity ID.' });
        }

        try {
            await deleteEntity(supabase, session.user.id, entityId);
            return {
                status: 200, // OK
                message: 'Entity deleted successfully.'
            };
        } catch (error: any) {
            console.error('Error deleting entity:', error);
            return fail(500, {
                message: `Database error deleting entity: ${error.message}`,
                deleteErrorId: entityId // Pass back ID for potential UI feedback
            });
        } 
        // SvelteKit's enhance should handle the UI update by reloading data
    },

    updateEntity: async ({ request, locals: { supabase, session } }: AuthenticatedEvent) => {
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();
        const entityId = formData.get('entityId') as string | null;
        const name = formData.get('name') as string | null;
        const description = formData.get('description') as string | null;

        // --- Basic Validation ---
        if (!entityId) {
            return fail(400, { message: 'Missing entity ID for update.' }); // Should not happen with hidden input
        }
        if (!name || name.trim().length === 0) {
            return fail(400, {
                message: 'Entity Name is required.',
                values: { entityId, name, description }, // Pass back ID for context
                isUpdate: true
            });
        }

        const trimmedName = name.trim();

        try {
            await updateEntity(supabase, session.user.id, entityId, {
                name: trimmedName,
                description: description?.trim() || null
            });
            return {
                status: 200, // OK
                message: `Entity "${trimmedName}" updated successfully.`
            };
        } catch (error: any) {
            console.error('Error updating entity:', error);
            if (error.code === '23505') { // Unique constraint violation
                return fail(409, {
                    message: `Another entity with the name "${trimmedName}" already exists.`,
                    values: { entityId, name, description },
                    isUpdate: true
                });
            }
            // Handle case where entity might not be found or other errors
            if (error.message === 'Entity not found or update failed.') {
                 return fail(404, { // Or 400/500 depending on how specific we want to be
                    message: `Entity not found or you don't have permission to update it.`,
                    values: { entityId, name, description },
                    isUpdate: true
                });
            }
            return fail(500, {
                message: `Database error updating entity: ${error.message}`,
                values: { entityId, name, description },
                isUpdate: true
            });
        } 
    }
};