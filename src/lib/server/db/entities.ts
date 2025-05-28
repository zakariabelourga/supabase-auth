import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entity } from '$lib/types'; // Entity type from $lib/types

/**
 * Fetches all entities for a given team, ordered by name.
 *
 * @param supabase - The Supabase client instance.
 * @param teamId - The ID of the team whose entities are to be fetched.
 * @returns A promise that resolves to an array of entities or throws an error.
 */
export async function getEntitiesForTeam(supabase: SupabaseClient, teamId: string): Promise<Entity[]> {
	const { data, error } = await supabase
		.from('entities')
		.select('id, name, description, created_at, team_id, user_id') // Select all relevant fields including team_id and user_id (creator)
		.eq('team_id', teamId) // Filter by team_id
		.order('name');

	if (error) {
		console.error('Error fetching entities for team:', error);
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
	teamId: string, // Changed from userId
	creatorUserId: string, // Added for creator's ID
	payload: CreateEntityPayload
): Promise<Entity> {
	const { data, error } = await supabase
		.from('entities')
		.insert({
			name: payload.name.trim(),
			description: payload.description?.trim() || null,
			user_id: creatorUserId, // Set creator's ID
			team_id: teamId // Set team's ID
		})
		.select('id, name, description, created_at, team_id, user_id') // Select all relevant fields
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
	teamId: string, // Changed from userId
	modifierUserId: string, // Added for modifier's ID
	entityId: string,
	payload: UpdateEntityPayload
): Promise<Entity> {
	const { data, error } = await supabase
		.from('entities')
		.update({
			name: payload.name.trim(),
			description: payload.description?.trim() || null,
			user_id: modifierUserId, // Update modifier's ID
			updated_at: new Date().toISOString() // Explicitly set updated_at
		})
		.match({ id: entityId, team_id: teamId }) // Match on entityId and teamId
		.select('id, name, description, created_at, team_id, user_id') // Select all relevant fields
		.single();

	if (error) {
		console.error('Error updating entity:', error);
		throw error;
	}
	if (!data) {
        // This case might happen if the entityId doesn't exist or doesn't belong to the team
        throw new Error('Entity not found or update failed.');
    }

	return data as Entity;
}

export async function deleteEntity(
	supabase: SupabaseClient,
	teamId: string, // Changed from userId
	entityId: string
): Promise<void> {
	const { error, count } = await supabase
		.from('entities')
		.delete()
		.match({ id: entityId, team_id: teamId }); // Match on entityId and teamId

	if (error) {
		console.error('Error deleting entity:', error);
		throw error;
	}

    if (count === 0) {
        // Optional: throw an error if no entity was deleted (e.g., wrong ID or not team's entity)
        console.warn(`Attempted to delete entity ${entityId} for team ${teamId}, but no matching record found.`);
    }
	// No return value needed for delete, or could return a success boolean/count
}