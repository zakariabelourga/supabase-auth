import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from '$lib/types';

/**
 * Fetches all categories, ordered by name.
 *
 * @param supabase - The Supabase client instance.
 * @returns A promise that resolves to an array of categories or throws an error.
 */
export async function getAllCategories(supabase: SupabaseClient): Promise<Category[]> {
	const { data, error } = await supabase
		.from('categories')
		.select('id, name')
		.order('name');

	if (error) {
		console.error('Error fetching categories:', error);
		// Re-throwing to be handled by the caller (e.g., the load function)
		throw error;
	}

	return (data as Category[]) ?? [];
} 