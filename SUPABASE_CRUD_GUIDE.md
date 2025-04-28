# Supabase Database CRUD Guide (SvelteKit SSR)

This guide provides examples for performing basic Create, Read, Update, and Delete (CRUD) operations on your Supabase database within this SvelteKit project, leveraging the established authentication and client setup.

**Refer back to `SUPABASE_AUTH_SUMMARY.md` for details on how the `supabase` client is initialized and how session/user data is accessed.**

## Prerequisites

1.  **Supabase Client:** You need access to the Supabase client instance.
    *   **Server (`.server.ts` files, Hooks):** Use `event.locals.supabase`.
    *   **Client (`.svelte` files):** Use `supabase` derived from layout data: `let { supabase } = $derived(data);`.
2.  **Authentication:** For operations that should be user-specific (most operations in a multi-tenant app), ensure the user is logged in. The Supabase client automatically uses the logged-in user's JWT.
3.  **Row Level Security (RLS):** **CRITICAL!** Ensure you have RLS policies enabled on your tables (`items`, `categories`, `tags`, `item_tags`, `profiles`). Most policies will typically check if the `user_id` column in the table matches the `auth.uid()` (the ID of the currently logged-in user). **Do not skip enabling RLS.**

## 1. Creating Data (Insert)

Use the `.insert()` method.

**Example: Adding a new Item (Server-Side Action in `+page.server.ts`)**

```typescript
// src/routes/private/items/+page.server.ts (Example)
import { fail, type Actions, redirect } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'
import type { SupabaseClient } from '@supabase/supabase-js'

// Helper type
type ActionEvent = RequestEvent & { locals: { supabase: SupabaseClient; session: Session | null } }

export const actions: Actions = {
  addItem: async ({ request, locals: { supabase, session } }: ActionEvent) => {
    if (!session) {
      return fail(401, { message: 'Unauthorized' })
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string; // Optional
    const categoryId = formData.get('categoryId') as string; // Assuming you have category selection
    const expiresAt = formData.get('expiresAt') as string; // Assuming date input

    // Basic validation
    if (!name || !categoryId || !expiresAt) {
      return fail(400, { message: 'Missing required fields', values: { name, description, categoryId, expiresAt } });
    }

    const { data, error } = await supabase
      .from('items')
      .insert([
        {
          name: name,
          description: description,
          category_id: categoryId, // Ensure column names match your DB schema
          expires_at: expiresAt, 
          user_id: session.user.id // Associate item with the logged-in user
          // Add other relevant fields like created_at, etc.
        },
      ])
      .select(); // Optional: Select the inserted data

    if (error) {
      console.error('Error adding item:', error);
      return fail(500, { message: `Database error: ${error.message}` });
    }

    console.log('Item added:', data);
    // Redirect or return success
    redirect(303, '/private/items'); // Redirect to items list for example
  },
};
```

**Example: Adding a new Tag (Client-Side in `.svelte`)**

```svelte
<script lang="ts">
  let { data } = $props();
  let { supabase } = $derived(data);
  let tagName = $state('');
  let message = $state('');

  async function addTag() {
    if (!supabase || !tagName.trim()) return;
    message = 'Adding...';

    const { error } = await supabase
      .from('tags')
      .insert({ name: tagName.trim() }); // Assuming tags might be global or you handle user association via RLS/triggers

    if (error) {
      message = `Error: ${error.message}`;
    } else {
      message = `Tag "${tagName}" added!`;
      tagName = '';
      // Optionally: Refresh tag list
    }
  }
</script>

<input type="text" bind:value={tagName} placeholder="New tag name" />
<button onclick={addTag} disabled={!tagName.trim()}>Add Tag</button>
{#if message}<p>{message}</p>{/if}
```

## 2. Reading Data (Select)

Use the `.select()` method. You can specify columns and apply filters.

**Example: Loading User's Items (Server-Side `load` in `+page.server.ts`)**

```typescript
// src/routes/private/items/+page.server.ts
import type { PageServerLoad } from './$types'
import { error as svelteKitError, redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals: { supabase, session } }) => {
  if (!session) {
    redirect(303, '/auth'); // Protect the page
  }

  // Fetch items belonging to the current user
  // Assuming RLS is enabled: "SELECT * FROM items WHERE user_id = auth.uid()"
  // The .eq('user_id', session.user.id) filter is technically redundant if RLS
  // is correctly set up for SELECT, but can be useful for clarity or if RLS
  // isn't fully restrictive yet.
  const { data: items, error } = await supabase
    .from('items')
    .select(`
      id,
      name,
      description,
      expires_at,
      created_at,
      category_id,
      categories ( name ) 
    `)
    // Optional but good practice server-side if not relying solely on RLS for SELECT filtering
    // .eq('user_id', session.user.id) 
    .order('expires_at', { ascending: true });

  if (error) {
    console.error('Error loading items:', error);
    // Use SvelteKit's error helper for server-load errors
    svelteKitError(500, 'Could not load items.');
  }

  // Fetch categories for a dropdown, for example
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name'); 
    // Consider if categories are user-specific or global

  if (categoriesError) {
     console.error('Error loading categories:', categoriesError);
     // Decide how to handle partial errors - maybe items load but categories don't?
  }

  return { items: items ?? [], categories: categories ?? [] };
};
```

**Example: Fetching Profile Data (Client-Side in `.svelte`)**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let { data: pageData } = $props();
  let { supabase, user } = $derived(pageData); // Assuming user object is passed down

  let profile = $state<any>(null);
  let loading = $state(true);
  let errorMessage = $state('');

  onMount(async () => {
    if (!supabase || !user) {
        errorMessage = 'Not logged in or Supabase client unavailable.';
        loading = false;
        return;
    }
    loading = true;
    errorMessage = '';

    const { data, error } = await supabase
      .from('profiles')
      .select('username, website, avatar_url') // Select specific columns
      .eq('id', user.id) // Filter for the logged-in user's profile
      .single(); // Expect only one row

    if (error && error.code !== 'PGRST116') { // PGRST116: row not found, maybe profile doesn't exist yet
      errorMessage = `Error fetching profile: ${error.message}`;
      console.error('Profile fetch error:', error);
    } else {
      profile = data;
    }
    loading = false;
  });
</script>

{#if loading}
  <p>Loading profile...</p>
{:else if errorMessage}
  <p class="error">{errorMessage}</p>
{:else if profile}
  <div>
    <h2>Profile</h2>
    <p>Username: {profile.username ?? 'Not set'}</p>
    <p>Website: {profile.website ?? 'Not set'}</p>
    <!-- Display avatar etc. -->
  </div>
{:else}
  <p>No profile found. You might need to create one.</p>
{/if}
```

## 3. Updating Data (Update)

Use the `.update()` method combined with a filter like `.match()` or `.eq()` to specify which rows to update.

**Example: Updating an Item (Server-Side Action)**

```typescript
// In actions object of src/routes/private/items/[itemId]/+page.server.ts (Example)
  updateItem: async ({ request, params, locals: { supabase, session } }: ActionEvent & { params: { itemId: string }}) => {
    if (!session) {
      return fail(401, { message: 'Unauthorized' })
    }

    const itemId = params.itemId;
    const formData = await request.formData();
    const name = formData.get('name') as string;
    // ... get other fields ...

    if (!name /* ... other validation ... */) {
      return fail(400, { message: 'Missing required fields' });
    }

    const { error } = await supabase
      .from('items')
      .update({
        name: name,
        // ... other fields ...
        // updated_at: new Date() // Good practice to update timestamp
      })
      .match({ id: itemId, user_id: session.user.id }); 
      // IMPORTANT: Match on both item ID AND user ID to prevent users updating others' items!
      // RLS for UPDATE should also enforce this.

    if (error) {
      console.error('Error updating item:', error);
      return fail(500, { message: `Database error: ${error.message}` });
    }

    // Redirect or return success
    redirect(303, '/private/items');
  },
```

## 4. Deleting Data (Delete)

Use the `.delete()` method combined with a filter like `.match()` or `.eq()`.

**Example: Deleting an Item (Client-Side - requires confirmation!)**

```svelte
<script lang="ts">
  let { data } = $props();
  let { supabase } = $derived(data);
  let itemIdToDelete = $props(); // Assuming passed as prop

  async function deleteItem() {
    if (!supabase || !itemIdToDelete) return;

    // **ALWAYS ASK FOR CONFIRMATION BEFORE DELETING!**
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    // You might need the user ID here if RLS isn't strictly enforcing based on auth.uid()
    // const { data: { user } } = await supabase.auth.getUser(); // If needed
    // if (!user) return; // Handle not logged in

    const { error } = await supabase
      .from('items')
      .delete()
      .match({ id: itemIdToDelete }); 
      // Relying on RLS: "DELETE FROM items WHERE id = {itemIdToDelete} AND user_id = auth.uid()"
      // Alternatively, explicitly match user ID: .match({ id: itemIdToDelete, user_id: user.id })

    if (error) {
      alert(`Error deleting item: ${error.message}`);
      console.error('Delete error:', error);
    } else {
      alert('Item deleted successfully.');
      // Refresh list or navigate away
      // Example: location.reload(); or goto('/private/items');
    }
  }
</script>

<button onclick={deleteItem} style="color: red;">Delete Item</button>
```

## Important Reminders

*   **RLS, RLS, RLS:** Cannot stress this enough. Ensure your RLS policies are active and correctly configured for `SELECT`, `INSERT`, `UPDATE`, `DELETE` based on `auth.uid()` for all tables containing user-specific data.
*   **Error Handling:** Always check the `error` object returned from Supabase calls. Provide feedback to the user or log errors appropriately.
*   **Server vs. Client:** Use server-side operations (actions, load) for sensitive operations, initial data loading, and when you need to guarantee execution regardless of client-side issues. Use client-side operations for UI-driven updates after the initial load.
*   **Column Names:** Double-check that the column names used in your code (`category_id`, `user_id`, `expires_at`, etc.) exactly match the names in your Supabase database schema.
*   **Relationships:** For fetching related data (like category name when fetching items), use Supabase's syntax for joining: `select('*, categories(*)')` or `select('*, category:categories(name)')`.

This guide provides a starting point. Refer to the official Supabase documentation for more advanced querying features, filters, and capabilities. 