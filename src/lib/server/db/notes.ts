import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemNote } from '$lib/types';

/**
 * Adds a new note to a specific item for a given user.
 *
 * @param supabase The Supabase client instance.
 * @param itemId The ID of the item to add the note to.
 * @param userId The ID of the user adding the note.
 * @param noteText The text content of the note.
 * @returns A promise that resolves to the newly created note or throws an error.
 * @throws Throws an error if the note creation fails.
 */
export async function addNoteToItem(
	supabase: SupabaseClient,
	itemId: string,
	userId: string,
	noteText: string
): Promise<ItemNote> {
	// First, verify the item exists and belongs to the user to prevent adding notes to unauthorized items.
	// This is a defense-in-depth measure, RLS should also protect this.
	const { data: itemOwnerCheck, error: checkError } = await supabase
		.from('items')
		.select('id')
		.eq('id', itemId)
		.eq('user_id', userId)
		.maybeSingle();

	if (checkError) {
		console.error('Error checking item ownership before adding note:', checkError);
		throw new Error(`Database error verifying item ownership: ${checkError.message}`);
	}

	if (!itemOwnerCheck) {
		throw new Error('Item not found or you do not have permission to add notes to it.');
	}

	const { data, error } = await supabase
		.from('item_notes')
		.insert({
			item_id: itemId,
			user_id: userId,
			note_text: noteText.trim()
		})
		.select()
		.single();

	if (error || !data) {
		console.error('Error adding note to database:', error);
		throw new Error(`Database error adding note: ${error?.message ?? 'Unknown error'}`);
	}
	return data as ItemNote;
}

/**
 * Deletes a note by its ID, ensuring it belongs to the specified user.
 *
 * @param supabase The Supabase client instance.
 * @param noteId The ID of the note to delete.
 * @param userId The ID of the user who owns the note (for an extra check beyond RLS).
 * @throws Throws an error if the deletion fails.
 */
export async function deleteNoteById(
	supabase: SupabaseClient,
	noteId: string,
	userId: string
): Promise<void> {
	const { error, count } = await supabase
		.from('item_notes')
		.delete()
		.match({ id: noteId, user_id: userId }); // Ensure user owns the note

	if (error) {
		console.error('Error deleting note from database:', error);
		throw new Error(`Database error deleting note: ${error.message}`);
	}

	if (count === 0) {
		// This could mean the note doesn't exist or doesn't belong to the user.
		// Depending on desired behavior, this could be a specific error or just logged.
		console.warn(`Attempted to delete note ${noteId} for user ${userId}, but no matching note was found or user mismatch.`);
		// Optionally throw: throw new Error('Note not found or not owned by user.');
	}
}

/**
 * Updates a note by its ID, ensuring it belongs to the specified user.
 *
 * @param supabase The Supabase client instance.
 * @param noteId The ID of the note to update.
 * @param userId The ID of the user who owns the note.
 * @param noteText The new text content for the note.
 * @returns A promise that resolves to the updated note or throws an error.
 * @throws Throws an error if the update fails.
 */
export async function updateNoteById(
	supabase: SupabaseClient,
	noteId: string,
	userId: string,
	noteText: string
): Promise<ItemNote> {
	const { data, error } = await supabase
		.from('item_notes')
		.update({
			note_text: noteText.trim(),
			updated_at: new Date().toISOString() // Explicitly set updated_at
		})
		.match({ id: noteId, user_id: userId })
		.select()
		.single();

	if (error || !data) {
		console.error('Error updating note in database:', error);
		throw new Error(`Database error updating note: ${error?.message ?? 'Unknown error'}`);
	}

	// Check if any row was actually updated
	// Note: .single() will error if no row matches, so if we reach here, a row was matched.
	// However, if RLS prevents update without erroring, 'data' might still be the old data if select() runs before RLS check.
	// Supabase typically returns the updated row on success with .select().

	return data as ItemNote;
}