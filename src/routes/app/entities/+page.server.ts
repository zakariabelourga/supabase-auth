import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { error as svelteKitError } from '@sveltejs/kit';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { AuthApiError } from '@supabase/supabase-js'; // Import for specific error checking

// Define a type for the event object enriched by hooks
type AuthenticatedEvent = {
	locals: {
		supabase: SupabaseClient;
		session: Session | null;
	};
	request: Request;
	params?: Partial<Record<string, string>>;
};

// Define the structure of an entity (can be reused or imported)
interface Entity {
	id: string;
	name: string;
	description: string | null;
	created_at: string;
}

export const load: PageServerLoad = async ({ locals: { supabase, session } }) => {
	if (!session) {
		redirect(303, '/auth'); // Protect the page
	}

	// Fetch user's entities
	const { data: entitiesData, error: entitiesError } = await supabase
		.from('entities')
		.select('id, name, description, created_at')
		.eq('user_id', session.user.id)
		.order('name');

	if (entitiesError) {
		console.error('Error loading entities:', entitiesError);
		svelteKitError(500, { message: `Could not load entities: ${entitiesError.message}` });
	}

	const entities: Entity[] = (entitiesData as unknown as Entity[]) ?? [];

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

		// --- Insert Entity ---
		const { error: insertError } = await supabase.from('entities').insert({
			name: trimmedName,
			description: description?.trim() || null,
			user_id: session.user.id
		});

		if (insertError) {
			console.error('Error adding entity:', insertError);

			// Check for unique constraint violation (PostgreSQL code 23505)
			if (insertError.code === '23505') {
				return fail(409, { // 409 Conflict
					message: `An entity with the name "${trimmedName}" already exists.`,
					values: { name, description }
				});
			}

			return fail(500, {
				message: `Database error adding entity: ${insertError.message}`,
				values: { name, description }
			});
		}

		// --- Success --- 
        // Optionally return the newly created entity if needed immediately on the frontend
        // For now, just return a success state. The page will reload data via enhance.
		return { 
            status: 201, // Created
            message: `Entity "${trimmedName}" added successfully.`
         }; 
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

        // Delete the entity, ensuring it belongs to the current user
        const { error } = await supabase
            .from('entities')
            .delete()
            .match({ id: entityId, user_id: session.user.id });

        if (error) {
            console.error('Error deleting entity:', error);
            return fail(500, {
                message: `Database error deleting entity: ${error.message}`,
                deleteErrorId: entityId // Pass back ID for potential UI feedback
            });
        }

        // Success
        return { 
            status: 200, // OK
            message: 'Entity deleted successfully.'
         }; 
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

        // --- Update Entity ---
        const { error: updateError } = await supabase
            .from('entities')
            .update({
                name: trimmedName,
                description: description?.trim() || null,
                // user_id is not updated, but ensured by the match clause
            })
            .match({ id: entityId, user_id: session.user.id }); // IMPORTANT: Match user ID!

        if (updateError) {
            console.error('Error updating entity:', updateError);

            // Check for unique constraint violation
            if (updateError.code === '23505') {
                return fail(409, { // 409 Conflict
                    message: `Another entity with the name "${trimmedName}" already exists.`,
                    values: { entityId, name, description },
                    isUpdate: true
                });
            }

            return fail(500, {
                message: `Database error updating entity: ${updateError.message}`,
                values: { entityId, name, description },
                isUpdate: true
            });
        }

        // --- Success ---
        return { 
            status: 200, // OK
            message: `Entity "${trimmedName}" updated successfully.`
        }; 
    }
}; 