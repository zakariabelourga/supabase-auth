import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { error as svelteKitError } from '@sveltejs/kit';
import type { SupabaseClient, Session } from '@supabase/supabase-js';

// Define a type for the event object enriched by hooks
type AuthenticatedEvent = {
	locals: {
		supabase: SupabaseClient;
		session: Session | null;
	};
	request: Request;
	params: Partial<Record<string, string>>;
};

// Define the structure of an item with its relations
interface ItemWithRelations {
	id: string;
	name: string;
	description: string | null;
	expiration: string; // Stored as date, retrieved as string
	created_at: string;
	updated_at: string;
	category: { id: string; name: string } | null; // Expecting an object or null
	tags: { id: string; name: string }[]; // Expecting an array
}

export const load: PageServerLoad = async ({ locals: { supabase, session } }) => {
	if (!session) {
		redirect(303, '/'); // Redirect to a safe page like home or auth
	}

	// Fetch items belonging to the current user, joining with categories and tags
	// RLS should enforce the user_id = auth.uid() check
	const { data, error: itemsError } = await supabase
		.from('items')
		.select(
			`
      id,
      name,
      description,
      expiration,
      created_at,
      updated_at,
      category: categories ( id, name ),
      tags ( id, name )
    `
		)
		.eq('user_id', session.user.id)
		.order('expiration', { ascending: true });

	// Explicitly type the fetched data, casting through unknown
	const items: ItemWithRelations[] = (data as unknown as ItemWithRelations[]) ?? [];

	if (itemsError) {
		console.error('Error loading items:', itemsError);
		svelteKitError(500, { message: `Could not load items: ${itemsError.message}` });
	}

	// Fetch all categories for the dropdown
	const { data: categoriesData, error: categoriesError } = await supabase
		.from('categories')
		.select('id, name')
		.order('name');

	// Explicitly type categories, casting through unknown if necessary (though less likely needed here)
	const categories: { id: string; name: string }[] = (categoriesData as unknown as { id: string; name: string }[]) ?? [];

	if (categoriesError) {
		console.error('Error loading categories:', categoriesError);
		// Handle error appropriately
	}

	// Processing items to ensure tags array is handled (already typed correctly now)
	const processedItems = items.map((item) => ({
		...item,
		// Category should already be correct type from ItemWithRelations
		// Tags should also be correct
	}));

	return {
		items: processedItems,
		categories: categories,
		streamed: {}
	};
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
		const tagsString = formData.get('tags') as string | null; // Expecting comma-separated tags

		// --- Basic Validation ---
		if (!name || !expiration) {
			return fail(400, {
				message: 'Missing required fields: Name and Expiration Date are required.',
				values: { name, description, categoryId, expiration, tagsString }
			});
		}
		// Optional: Add more robust date validation if needed

		// --- 1. Insert the Item ---
		const { data: newItemData, error: insertError } = await supabase
			.from('items')
			.insert({
				name: name,
				description: description,
				category_id: categoryId || null, // Handle optional category
				expiration: expiration,
				user_id: session.user.id
				// created_at and updated_at should default in the DB
			})
			.select('id') // Select the ID of the newly created item
			.single(); // Expecting a single row back

		if (insertError || !newItemData) {
			console.error('Error adding item:', insertError);
			return fail(500, {
				message: `Database error adding item: ${insertError?.message ?? 'Unknown error'}`,
				values: { name, description, categoryId, expiration, tagsString }
			});
		}

		const newItemId = newItemData.id;

		// --- 2. Handle Tags ---
		const tagNames =
			tagsString
				?.split(',')
				.map((tag) => tag.trim())
				.filter((tag) => tag.length > 0) ?? []; // Clean up tag names

		let allTagIds: string[] = [];

		if (tagNames.length > 0) {
			try {
				// --- 2a. Find Existing Tags for this User ---
				const { data: existingTags, error: existingTagsError } = await supabase
					.from('tags')
					.select('id, name')
					.eq('user_id', session.user.id)
					.in('name', tagNames);

				if (existingTagsError) throw existingTagsError; // Throw to catch block

				const existingTagMap = new Map(existingTags.map((tag) => [tag.name, tag.id]));
				allTagIds = existingTags.map((tag) => tag.id);

				// --- 2b. Identify and Insert New Tags ---
				const newTagNames = tagNames.filter((name) => !existingTagMap.has(name));

				if (newTagNames.length > 0) {
					const { data: insertedTags, error: insertTagsError } = await supabase
						.from('tags')
						.insert(newTagNames.map((name) => ({ name, user_id: session.user.id })))
						.select('id');

					if (insertTagsError) throw insertTagsError; // Throw to catch block

					allTagIds = allTagIds.concat(insertedTags.map((tag) => tag.id));
				}

				// --- 2c. Link Item and Tags in Join Table ---
				if (allTagIds.length > 0) {
					const { error: itemTagsError } = await supabase
						.from('item_tags')
						.insert(allTagIds.map((tagId) => ({ item_id: newItemId, tag_id: tagId })));

					if (itemTagsError) throw itemTagsError; // Throw to catch block
				}
			} catch (tagError: any) {
				console.error('Error handling tags:', tagError);
				// Note: Item was already inserted. Consider cleanup or alert user about partial success.
				// For simplicity now, we'll return a specific error but won't delete the item.
				return fail(500, {
					message: `Item added, but failed to process tags: ${tagError.message}`,
					values: { name, description, categoryId, expiration, tagsString },
					itemAddedButTagsFailed: true // Flag for UI
				});
			}
		}

		// --- Success ---
		// No explicit redirect needed if using enhance, but good for non-JS fallback
	   redirect(303, '/app/items');
	}

	// Add updateItem and deleteItem actions here later
}; 