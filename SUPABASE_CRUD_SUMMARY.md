# Supabase Database CRUD Implementation Summary (SvelteKit SSR)

This document summarizes how Create, Read, Update, and Delete (CRUD) operations are handled with the Supabase database within this SvelteKit project, building upon the authentication setup described in `SUPABASE_AUTH_SUMMARY.md`.

## Database Tables Overview

This section details the schema and RLS policies for the relevant tables as provided.

### `profiles`
*   **Description:** Stores user profile information linked to `auth.users`.
*   **Columns:**
    *   `id` (uuid, primary key, foreign key references auth.users(id))
    *   `updated_at` (timestamp with time zone, nullable)
    *   `username` (text, nullable, unique)
    *   `full_name` (text, nullable)
    *   `avatar_url` (text, nullable)
    *   `website` (text, nullable)
*   **RLS Policies:**
    *   SELECT: "Public profiles are viewable by everyone." (PERMISSIVE)
    *   INSERT: "Users can insert their own profile." (PERMISSIVE, Check: `auth.uid() = id`)
    *   UPDATE: "Users can update own profile." (PERMISSIVE, Using: `auth.uid() = id`)
*   **Notes:** This is the primary table where user-specific profile data is stored and managed. RLS is crucial here.

### `categories`
*   **Description:** Stores predefined categories for items.
*   **Columns:**
    *   `id` (uuid, primary key, default: gen_random_uuid())
    *   `name` (text, not null)
    *   `created_at` (timestamp with time zone, default: now())
*   **RLS Policies:** None defined (data is likely considered public or managed administratively).
*   **Notes:** Used to populate dropdowns in the item form.

### `entities`
*   **Description:** Stores user-created provider/entity information.
*   **Columns:**
    *   `id` (uuid, primary key, default: gen_random_uuid())
    *   `user_id` (uuid, not null, foreign key references auth.users(id))
    *   `name` (text, not null)
    *   `description` (text, nullable)
    *   `created_at` (timestamp with time zone, default: now())
    *   Constraint: `entities_user_id_name_key` UNIQUE (`user_id`, `name`)
*   **RLS Policies:** SELECT, INSERT, UPDATE, DELETE based on `auth.uid() = user_id`.
*   **Notes:** Users manage their own entities. RLS ensures users only interact with their own data.

### `tags`
*   **Description:** Stores user-created tags.
*   **Columns:**
    *   `id` (uuid, primary key, default: gen_random_uuid())
    *   `user_id` (uuid, not null, foreign key references profiles(id)) *(Note: Should likely reference auth.users(id) directly for consistency)*
    *   `name` (text, not null)
    *   `created_at` (timestamp with time zone, default: now())
*   **RLS Policies:** None defined (Security relies on matching `user_id` in actions).
*   **Notes:** Tags are created on-the-fly when adding/editing items.

### `items`
*   **Description:** The core table storing expiration-tracked items.
*   **Columns:**
    *   `id` (uuid, primary key, default: gen_random_uuid())
    *   `user_id` (uuid, not null, foreign key references profiles(id)) *(Note: Should likely reference auth.users(id) directly)*
    *   `name` (text, not null)
    *   `description` (text, nullable)
    *   `category_id` (uuid, nullable, foreign key references categories(id))
    *   `expiration` (date, not null)
    *   `created_at` (timestamp with time zone, default: now())
    *   `updated_at` (timestamp with time zone, default: now())
    *   `entity_id` (uuid, nullable, foreign key references entities(id) ON DELETE SET NULL)
    *   `entity_name_manual` (text, nullable)
*   **RLS Policies:** None defined (Security relies on matching `user_id` in actions).
*   **Notes:** This is the central table. Security is enforced primarily through application-level checks in server actions.

### `item_tags`
*   **Description:** Junction table linking `items` and `tags` (Many-to-Many).
*   **Columns:**
    *   `item_id` (uuid, not null, foreign key references items(id) ON DELETE CASCADE) *(Recommended: Cascade delete)*
    *   `tag_id` (uuid, not null, foreign key references tags(id) ON DELETE CASCADE) *(Recommended: Cascade delete)*
*   **RLS Policies:** None defined (Access controlled via actions modifying linked items/tags).
*   **Notes:** Enables the many-to-many relationship.

### `item_notes`
*   **Description:** Stores notes associated with specific items.
*   **Columns:**
    *   `id` (uuid, primary key, default: gen_random_uuid())
    *   `item_id` (uuid, not null, foreign key references items(id) ON DELETE CASCADE)
    *   `user_id` (uuid, not null, foreign key references auth.users(id) ON DELETE CASCADE)
    *   `note_text` (text, not null, CHECK constraint prevents empty)
    *   `created_at` (timestamp with time zone, default: now())
    *   `updated_at` (timestamp with time zone, default: now(), trigger recommended)
*   **RLS Policies:**
    *   SELECT: Allow `auth.uid() = user_id`
    *   INSERT: Allow `auth.uid() = user_id`
    *   UPDATE: Allow `auth.uid() = user_id`
    *   DELETE: Allow `auth.uid() = user_id`
*   **Notes:** `item_id` cascade ensures notes are deleted if the parent item is deleted. RLS ensures users manage only their own notes.

## Core Concepts & Setup (Revised)

1.  **Supabase Client Access:**
    *   **Server (`.server.ts` files, Hooks):** The authenticated Supabase client is accessed via `event.locals.supabase`. This client instance is request-specific and automatically uses the logged-in user's JWT, enforcing RLS policies.
    *   **Client (`.svelte` files):** The client-side Supabase client is passed down through layout data and accessed via `$derived`: `let { supabase } = $derived(data);`. This is primarily used for *client-side* actions (not covered extensively in this summary but possible for things like real-time subscriptions) or potentially simple reads if server-side loading isn't necessary. Most data fetching and all mutations (Create, Update, Delete) in this pattern are handled server-side.
    *   **(Reference `SUPABASE_AUTH_SUMMARY.md` for client initialization details).**

2.  **Server-Side Data Loading (`load`):**
    *   **Primary Method:** The `load` function within `+page.server.ts` files is the primary method for fetching data required for a page, especially data that requires authentication or involves relational joins.
    *   **Security:** Ensures data fetching happens securely on the server, respecting RLS policies before the page is rendered.
    *   **Joins:** Supabase's join syntax (`related_table ( columns ), other_related_table ( columns )`) is used within `.select()` to efficiently fetch related data (e.g., category names, tags, linked entity names for items).
    *   **Type Safety:** TypeScript interfaces (e.g., `ItemWithRelations`, `Entity`) are defined to represent the expected shape of data returned from Supabase, including joined relations. Type casting (`data as unknown as Interface[]`) is used to align the fetched data with these interfaces, improving intellisense and catching potential errors.
    *   **Data Passing:** The fetched data (e.g., `items`, `categories`, `entities`) is returned from the `load` function, making it available in the corresponding `+page.svelte` component via the `data` prop (`let { data } = $props();`).
    *   **Type Safety Note:** Due to limitations in the Supabase client's generic typing, especially with joins returning single related objects, we sometimes need to cast the fetched `data as unknown as ExpectedType[]` to align it with our more specific TypeScript interfaces. Always define clear interfaces for your expected data shapes.

3.  **Server-Side Mutations (`actions`):**
    *   **Primary Method:** All Create, Update, and Delete operations are handled via named SvelteKit `actions` defined within the `actions` object in `+page.server.ts` files.
    *   **Security:** Actions run exclusively on the server, preventing direct database manipulation from the client. Authentication is checked at the start of each action using `event.locals.session`. Operations like `update` and `delete` explicitly use `.match({ id: ..., user_id: session.user.id })` as a defense-in-depth measure alongside RLS.
    *   **Data Input:** Actions receive form data via the `request` object (`await request.formData()`).
    *   **Validation:** Server-side validation (e.g., checking for required fields, checking for duplicate names before insertion/update) is performed within the action.
    *   **Complex Logic:** Actions handle database interactions, including:
        *   Simple inserts/updates/deletes.
        *   Checking for existing related records (e.g., checking if an entity name matches an existing one).
        *   Handling relationships (e.g., creating/linking/unlinking tags in `addItem`/`updateItem`).
    *   **Return Values:**
        *   On validation errors or database errors, actions return `fail(statusCode, { message: ..., values: { ... } })`. Including `values` allows the form on the client to be repopulated.
        *   On success, actions typically return a success object (e.g., `{ status: 200, message: 'Success!' }`) or use `redirect()`. Redirects are less necessary when using progressive enhancement effectively.
    *   **Standard Error Handling:** Standard error handling uses `fail(statusCode, { message: ..., values: {...} })`. The `message` is displayed to the user via the `$form` prop. Including `values` allows repopulating the form on validation errors. Check `error.code` for specific database errors (like unique constraint '23505') to provide more specific feedback.

4.  **Frontend Integration (`.svelte` Components):**
    *   **Data Access:** Components receive loaded data via `let { data } = $props();` and reactive form action results via `let { form } = $props();`. `$derived` is used for reactive access: `let { items, categories, entities } = $derived(data);`.
    *   **Displaying Data:** Fetched data (e.g., `items`, `entities`) is displayed using `#each` blocks, typically within HTML tables. Helper functions are sometimes used for formatting (e.g., dates, entity display names).
    *   **Forms & Progressive Enhancement:**
        *   HTML `<form>` tags are used with `method="POST"` and the `action` attribute pointing to the specific server action (e.g., `action="?/addItem"`, `action="?/updateEntity"`).
        *   `use:enhance` Pattern:** The `use:enhance` directive enables progressive enhancement. The typical flow is: Form submits -> Server action runs -> Action returns JSON result (success or `fail`) -> SvelteKit updates the page's `$form` prop -> `$effect` blocks in the component react to `$form` changes to update UI (e.g., close form, show messages), and SvelteKit automatically re-runs relevant `load` functions to refresh data.
        *   The optional `handleSubmit` function passed to `enhance` allows controlling UI state during submission (like setting `isSubmitting`) and awaiting the update.
    *   **Add/Edit Form Logic:**
        *   State variables (`showForm`, `editingItem`/`editingEntity`, `isEditMode`) manage whether the form is displayed and if it's in "add" or "edit" mode.
        *   The form's `action`, button labels, titles, and input `value` attributes are conditionally rendered based on `isEditMode`.
        *   When editing, the form is pre-filled using the `editingItem`/`editingEntity` data. Helper functions assist in formatting data correctly for inputs (e.g., `formatDateForInput`, `formatTagsForInput`).
        *   If an action fails validation and returns `fail` with `values`, the form inputs are repopulated using `(form as any)?.values?.fieldName ?? defaultEditValue ?? ''`. The `as any` assertion is used because SvelteKit's default `form` type doesn't know about our custom `values` structure.
    *   **Displaying Action Feedback:** Action results are displayed using the reactive `form` prop: `{#if form?.message} ... {/if}`. Alert styles can be conditionally applied based on `form.status` or other flags returned by the action.
    *   **Client-Side Confirmation:** For destructive actions (Delete), an `onsubmit` handler using an arrow function (`onsubmit={() => { if (!confirm(...)) return false; }}`) provides client-side confirmation before the form is submitted.
    *   **Component Refactoring:** Reusable form components (e.g., `src/lib/components/ItemForm.svelte`) are created to handle common UI logic for adding/editing, receiving necessary data (like the item being edited, related data like categories/entities) and action results (`$form`) as props.

5.  **Row Level Security (RLS) & Action-Level Checks:**
    *   **RLS Importance:** RLS is a powerful security feature available in Supabase/PostgreSQL.
    *   **Current Implementation:** Based on the provided schemas:
        *   The `profiles` table has RLS policies defined, restricting access appropriately.
        *   The `entities` table *should* have RLS policies (as added via SQL) to ensure users only manage their own entities.
        *   The `items`, `tags`, `item_tags`, and `categories` tables currently **do not** have specific RLS policies defined.
    *   **Security Reliance:** For tables without explicit RLS (`items`, `tags`, `entities` before manual addition), security relies heavily on **server-side action logic**. Actions consistently use `.match({ ..., user_id: session.user.id })` or `.eq('user_id', session.user.id)` within Supabase queries (inserts, updates, deletes, selects) to ensure users only interact with their own data.
    *   **Recommendation:** While action-level checks provide security, **enabling RLS on all tables containing user-specific data (`items`, `tags`, `entities`) is strongly recommended** as a best practice and defense-in-depth measure. RLS enforces security at the database level, regardless of application code errors.
    *   The `item_notes` table has RLS policies ensuring users only interact with their own notes.

## Specific Implementations (Revised)

### Items

*   **Routes:**
    *   `/app/items`: List page.
    *   `/app/items/[itemId]`: Detail/Edit page.
*   **Schema:** See `items`, `item_tags`, `item_notes` in Database Tables Overview section.
*   **Component:** `src/lib/components/ItemForm.svelte` handles the form UI for add/edit.
*   **List Page (`/app/items/+page.server.ts`, `+page.svelte`):**
    *   **Load:** Fetches user's items (no notes needed for list view).
    *   **Actions:** `addItem`, `deleteItem`.
    *   **Frontend:** Displays item list table. Uses `ItemForm` component for adding new items (`item={null}`). Links Edit button to the detail page. Includes delete form.
*   **Detail Page (`/app/items/[itemId]/+page.server.ts`, `+page.svelte`):**
    *   **Load:** Fetches the specific item (matching `itemId` and `user_id`) including related `categories`, `tags`, `entities`, and `item_notes`. Also fetches `categories` and `entities` for the form.
    *   **Actions:** `updateItem`, `addNote`, `updateNote`, `deleteNote`.
    *   **Frontend:** Uses `ItemForm` component for editing the loaded item. Displays the list of notes. Includes forms for adding, editing (inline), and deleting notes.
*   **`updateItem` Action:** Now located in `[itemId]/+page.server.ts`, uses `params.itemId`.
*   **Notes Actions (`addNote`, `updateNote`, `deleteNote`):** Located in `[itemId]/+page.server.ts`, operate on `item_notes` table, matching on `noteId` and `user_id` for security.

### Entities (`/app/entities`)

*   **Schema:** See Database Tables Overview section.
*   **Load:** Fetches entities where `user_id` matches the logged-in user.
*   **`addEntity` Action:** Inserts entity, setting `user_id`. Handles unique constraint violations.
*   **`updateEntity` Action:** Updates entity, matching on `id` and `user_id`.
*   **`deleteEntity` Action:** Deletes entity, matching on `id` and `user_id`.
*   **Frontend:** Displays entities. Uses a single form for Add/Edit.

## Code Structure Conventions
*   Server-side logic (`load` functions, `actions`) for a specific route (e.g., `/app/feature`) resides in `src/routes/app/feature/+page.server.ts`.
*   Detail pages typically use dynamic routes (e.g., `/app/feature/[id]`).
*   Reusable UI components, like forms, are placed in `src/lib/components/` (e.g., `ItemForm.svelte`).

This summary provides a high-level overview of the established patterns for interacting with Supabase in this project. Refer to the specific `+page.server.ts` and `+page.svelte` files for detailed implementation logic. 