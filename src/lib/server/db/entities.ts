import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entity } from '$lib/types';

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
		.select('id, name, description') // Assuming description is part of the Entity type
		.eq('user_id', userId)
		.order('name');

	if (error) {
		console.error('Error fetching entities for user:', error);
		// Re-throwing to be handled by the caller
		throw error;
	}

	return (data as Entity[]) ?? [];
} 