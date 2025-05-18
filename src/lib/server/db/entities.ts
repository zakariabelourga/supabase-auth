import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entity } from '$lib/types'; // Entity type from $lib/types

/**
 * Fetches all entities for a given user, ordered by name.
 *
 * @param supabase - The Supabase client instance.
 * @param userId - The ID of the user whose entities are to be fetched.
 * @returns A promise that resolves to an array of entities or throws an error.
 */
export async function getEntitiesForUser(supabase: SupabaseClient, userId: string): Promise<Entity[]> {
	const { data, error } = await supabase
		.from('entities')
		.select('id, name, description, created_at') // Assuming description and created_at are part of the Entity type
		.eq('user_id', userId)
		.order('name');

	if (error) {
		console.error('Error fetching entities for user:', error);
		// Re-throwing to be handled by the caller
		throw error;
	}

	return (data as Entity[]) ?? [];
}

export interface CreateEntityPayload {
	name: string;
	description: string | null;
}

export async function createEntity(
	supabase: SupabaseClient,
	userId: string,
	payload: CreateEntityPayload
): Promise<Entity> {
	const { data, error } = await supabase
		.from('entities')
		.insert({
			name: payload.name.trim(),
			description: payload.description?.trim() || null,
			user_id: userId
		})
		.select('id, name, description, created_at') // Select the fields for the returned entity
		.single(); // Expect a single row back

	if (error) {
		console.error('Error creating entity:', error);
		// Re-throw to be handled by the caller, potentially with specific error codes
		throw error;
	}
	
	return data as Entity;
}

export interface UpdateEntityPayload {
	name: string;
	description: string | null;
}

export async function updateEntity(
	supabase: SupabaseClient,
	userId: string,
	entityId: string,
	payload: UpdateEntityPayload
): Promise<Entity> {
	const { data, error } = await supabase
		.from('entities')
		.update({
			name: payload.name.trim(),
			description: payload.description?.trim() || null
		})
		.match({ id: entityId, user_id: userId })
		.select('id, name, description, created_at')
		.single();

	if (error) {
		console.error('Error updating entity:', error);
		throw error;
	}
	if (!data) {
        // This case might happen if the entityId doesn't exist or doesn't belong to the user
        // Or if the update didn't change any rows (though .single() might still error if no rows match)
        throw new Error('Entity not found or update failed.');
    }

	return data as Entity;
}

export async function deleteEntity(
	supabase: SupabaseClient,
	userId: string,
	entityId: string
): Promise<void> {
	const { error, count } = await supabase
		.from('entities')
		.delete()
		.match({ id: entityId, user_id: userId });

	if (error) {
		console.error('Error deleting entity:', error);
		throw error;
	}

    if (count === 0) {
        // Optional: throw an error if no entity was deleted (e.g., wrong ID or not user's entity)
        // This depends on desired behavior. For now, we'll consider it non-fatal if nothing matched.
        console.warn(`Attempted to delete entity ${entityId} for user ${userId}, but no matching record found.`);
    }
	// No return value needed for delete, or could return a success boolean/count
}