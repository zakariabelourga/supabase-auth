import { fail, redirect, error as svelteKitError } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEntitiesForTeam, createEntity, updateEntity, deleteEntity } from '$lib/server/db/entities';
import type { Entity, ActiveTeam } from '$lib/types';

export const load: PageServerLoad = async (event) => {
    const { locals: { supabase, session, activeTeam } } = event;
    if (!session) {
        redirect(303, '/auth'); 
    }

    if (!activeTeam?.id) {
        console.warn('No active team found for user on entities page, redirecting.');
        redirect(303, '/app/teams?notice=no-active-team');
    }

    let entities: Entity[] = [];
    try {
        entities = await getEntitiesForTeam(supabase, activeTeam.id);
    } catch (error: any) {
        console.error('Error loading entities:', error);
        svelteKitError(500, { message: `Could not load entities: ${error.message}` });
    }

    return {
        entities: entities
    };
};

export const actions: Actions = {
    addEntity: async (event) => {
        const { request, locals: { supabase, session, activeTeam } } = event;
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }
        if (!activeTeam?.id) {
            return fail(400, { message: 'No active team selected. Cannot add entity.' });
        }

        const formData = await request.formData();
        const name = formData.get('name') as string | null;
        const description = formData.get('description') as string | null;

        if (!name || name.trim().length === 0) {
            return fail(400, {
                message: 'Entity Name is required.',
                values: { name, description }
            });
        }

        const trimmedName = name.trim();

        try {
            await createEntity(supabase, activeTeam.id, session.user.id, {
                name: trimmedName,
                description: description?.trim() || null
            });
            return {
                status: 201, 
                message: `Entity "${trimmedName}" added successfully.`
            };
        } catch (error: any) {
            console.error('Error adding entity:', error);
            if (error.code === '23505') { 
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
    },

    deleteEntity: async (event) => {
        const { request, locals: { supabase, session, activeTeam } } = event;
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }
        if (!activeTeam?.id) {
            return fail(400, { message: 'No active team selected. Cannot delete entity.' });
        }

        const formData = await request.formData();
        const entityId = formData.get('entityId') as string | null;

        if (!entityId) {
            return fail(400, { message: 'Missing entity ID.' });
        }

        try {
            await deleteEntity(supabase, activeTeam.id, entityId);
            return {
                status: 200, 
                message: 'Entity deleted successfully.'
            };
        } catch (error: any) {
            console.error('Error deleting entity:', error);
            return fail(500, {
                message: `Database error deleting entity: ${error.message}`,
                deleteErrorId: entityId 
            });
        } 
    },

    updateEntity: async (event) => {
        const { request, locals: { supabase, session, activeTeam } } = event;
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }
        if (!activeTeam?.id) {
            return fail(400, { message: 'No active team selected. Cannot update entity.' });
        }

        const formData = await request.formData();
        const entityId = formData.get('entityId') as string | null;
        const name = formData.get('name') as string | null;
        const description = formData.get('description') as string | null;

        if (!entityId) {
            return fail(400, { message: 'Missing entity ID for update.' }); 
        }
        if (!name || name.trim().length === 0) {
            return fail(400, {
                message: 'Entity Name is required.',
                values: { entityId, name, description }, 
                isUpdate: true
            });
        }

        const trimmedName = name.trim();

        try {
            await updateEntity(supabase, activeTeam.id, session.user.id, entityId, {
                name: trimmedName,
                description: description?.trim() || null
            });
            return {
                status: 200, 
                message: `Entity "${trimmedName}" updated successfully.`
            };
        } catch (error: any) {
            console.error('Error updating entity:', error);
            if (error.code === '23505') { 
                return fail(409, {
                    message: `Another entity with the name "${trimmedName}" already exists.`,
                    values: { entityId, name, description },
                    isUpdate: true
                });
            }
            if (error.message === 'Entity not found or update failed.') {
                 return fail(404, { 
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