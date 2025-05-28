# Teams Functionality: Implementation Progress Summary

This document summarizes the development progress for implementing the Teams functionality as outlined in `TEAMS_FUNCTIONALITY.md`.

## Phase 1: Backend Setup (Supabase & Server-side SvelteKit)

### 1. Database Schema Implementation

**A. New Tables Created:**

*   **`public.teams`**
    *   `id`: `uuid` (Primary Key, default: `uuid_generate_v4()`)
    *   `name`: `text` (Not Null)
    *   `owner_user_id`: `uuid` (Foreign Key to `auth.users.id`, Not Null, `ON DELETE RESTRICT`)
    *   `created_at`: `timestamptz` (default: `now()`)
    *   `updated_at`: `timestamptz` (default: `now()`)
*   **`public.team_members`** (Junction table)
    *   `team_id`: `uuid` (Foreign Key to `teams.id` `ON DELETE CASCADE`, Part of Composite Primary Key)
    *   `user_id`: `uuid` (Foreign Key to `auth.users.id` `ON DELETE CASCADE`, Part of Composite Primary Key)
    *   `role`: `public.team_role` (Enum, Not Null)
    *   `joined_at`: `timestamptz` (default: `now()`)
*   **`public.team_invitations`**
    *   `id`: `uuid` (Primary Key, default: `uuid_generate_v4()`)
    *   `team_id`: `uuid` (FK to `teams.id` `ON DELETE CASCADE`)
    *   `email_invited`: `text` (Not Null)
    *   `invited_by_user_id`: `uuid` (FK to `auth.users.id` `ON DELETE CASCADE`)
    *   `status`: `public.invitation_status` (Enum, Not Null, default: 'pending')
    *   `created_at`: `timestamptz` (default: `now()`)
    *   `expires_at`: `timestamptz` (Nullable)

**B. New ENUM Types Created:**

*   `public.team_role`: (`'admin'`, `'editor'`, `'viewer'`)
*   `public.invitation_status`: (`'pending'`, `'accepted'`, `'declined'`)

**C. Modifications to Existing Tables:**

*   **`public.items`**:
    *   Added `team_id`: `uuid` (Foreign Key to `teams.id`, Nullable, `ON DELETE RESTRICT`).
*   **`public.entities`**:
    *   Added `team_id`: `uuid` (Foreign Key to `teams.id`, Nullable, `ON DELETE RESTRICT`).
*   **`public.tags`**:
    *   Added `team_id`: `uuid` (Foreign Key to `teams.id`, Nullable, `ON DELETE RESTRICT`).
*   `public.categories` remains global and unchanged regarding team association.

**D. Helper SQL Functions Created:**

*   `public.is_team_member(p_team_id uuid, p_user_id uuid) RETURNS boolean`: Checks if a user is a member of a team.
*   `public.get_user_role_in_team(p_team_id uuid, p_user_id uuid) RETURNS public.team_role`: Gets a user's role in a team.
*   **NEW:** `public.get_user_id_by_email(email_text text) RETURNS uuid` (SECURITY DEFINER): Retrieves a user's ID by their email address. Used for the invite functionality.

**E. Row Level Security (RLS) Policies Defined and Applied (All policies are now in a secure and functional state):**

*   **`public.teams`**:
    *   `INSERT`: "Allow authenticated users to create teams" (`WITH CHECK (owner_user_id = auth.uid())`). Ensures the creator is set as the owner.
    *   `SELECT`: "Allow members or owner to view their teams" (`USING (public.is_team_member(id, auth.uid()) OR owner_user_id = auth.uid())`).
    *   `UPDATE`: "Allow team admins to update their teams" (`USING (public.get_user_role_in_team(id, auth.uid()) = 'admin'::public.team_role) WITH CHECK (public.get_user_role_in_team(id, auth.uid()) = 'admin'::public.team_role)`).
    *   `DELETE`: "Allow team admins to delete their teams" (`USING (public.get_user_role_in_team(id, auth.uid()) = 'admin'::public.team_role)`).
*   **`public.team_members`**:
    *   `SELECT`: "View team members" (`USING (public.is_team_member(public.team_members.team_id, auth.uid()))`).
    *   `INSERT`: "Admins can add team members OR owner can add self as admin during team creation" (`WITH CHECK (((get_user_role_in_team(team_id, auth.uid()) = 'admin'::team_role) OR (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND t.owner_user_id = auth.uid()) AND team_members.user_id = auth.uid() AND team_members.role = 'admin'::team_role)))`). This resolved the team creation blocker.
    *   `UPDATE`: "Admins can update roles of other team members" (Admins can update others' roles, immutability of `team_id`, `user_id` handled by trigger).
    *   `DELETE`: "Admins can remove other team members" & "Members can leave team".
*   **`public.team_invitations`**:
    *   `INSERT`: "Admins can create team invitations".
    *   `SELECT`: "Users can view their invitations and admins their team invitations".
    *   `UPDATE`: "Invited users can update status of their pending invitations" (Invitees can accept/decline, immutability of other fields handled by trigger).
    *   `DELETE`: "Admins can delete pending invitations for their team".
*   **`public.items`**, **`public.entities`**, **`public.tags`**:
    *   `SELECT`: Allows any team member (`is_team_member`).
    *   `INSERT`: Allows team 'admin' or 'editor' (`get_user_role_in_team`).
    *   `UPDATE`: Allows team 'admin' or 'editor'.
    *   `DELETE`: Allows team 'admin' or 'editor'.

**F. Triggers Created (for RLS workarounds due to `OLD.` syntax issues):**

*   On `public.team_members` (`BEFORE UPDATE`):
    *   `enforce_team_member_immutability` using `public.prevent_team_member_immutable_fields_update()`: Prevents changes to `team_id` and `user_id` on update.
*   On `public.team_invitations` (`BEFORE UPDATE`):
    *   `enforce_invitation_immutability_by_invitee` using `public.prevent_invitation_immutable_fields_update_by_invitee()`: Prevents invitees from changing immutable fields when accepting/declining.

**G. Database Privileges (Grants):**

*   The `authenticated` role has been granted `SELECT`, `INSERT`, `UPDATE`, `DELETE` (and others) on `public.teams`.
*   Similar grants likely exist or were implicitly handled for other tables based on RLS setup.

### 2. Type Generation & Configuration

*   Supabase type definitions (`src/lib/supabase.ts`) were regenerated after schema changes and login issues were resolved. This fixed type errors for RPC calls.
*   Custom types in `src/lib/types.ts` were updated:
    *   Added `team_id: string | null;` to `LinkedEntity`, `Entity`, `Tag`, `ItemEntry`.
    *   Added new types: `TeamRole` (enum), `InvitationStatus` (enum), `Team` (interface), `TeamMember` (interface), `TeamInvitation` (interface).
*   `src/app.d.ts` correctly imports `Database` from `src/lib/supabase.ts` for `SupabaseClient` typing.

### 3. Data Migration Strategy & Script

*   A SQL script was developed and executed for the single existing user (`bc2e82aa-5293-4606-940d-77d57bfd9702`):
    1.  Created a new "Personal Team".
    2.  Made the user an 'admin' of this new team in `team_members`.
    3.  Updated their existing `items`, `entities`, and `tags` by populating `team_id` to associate them with this new personal team.

### 4. Server-Side API Endpoints (SvelteKit)

*   **`src/routes/app/teams/+page.server.ts`** updated:
    *   **`load` function**: Fetches and returns a list of teams the current user is a member of (along with their role in each team). This is working correctly.
    *   **`actions.createTeam`**:
        *   Successfully creates a new team and adds the creator as an 'admin'.
        *   Returns an explicit success object `{ success: true, message: ..., teamId: ..., teamName: ..., error: null }` for consistent frontend handling.
    *   **`actions.renameTeam`**: Implemented to allow admins to rename their teams. Returns success/failure objects.
    *   **`actions.deleteTeam`**: Implemented to allow admins to delete their teams. Returns success/failure objects.
    *   **`actions.inviteUser`**: Implemented to allow admins to invite users by email.
        *   Uses the `get_user_id_by_email` RPC.
        *   Checks if the user is already a member.
        *   Adds the user to `team_members` (currently, direct add; `team_invitations` table usage to be reviewed).
        *   Returns success/failure objects.

### 5. Frontend UI (`+page.svelte`)

*   Displays the list of teams fetched by the `load` function.
*   **Create Team Form**:
    *   Calls the `createTeam` action.
    *   Handles form feedback (success/error messages) correctly due to standardized action return types.
*   **Admin Controls (per team, for admins only)**:
    *   **Rename Team**: Inline form, calls `renameTeam` action.
    *   **Invite User**: Inline form (email, role), calls `inviteUser` action.
    *   **Delete Team**: Button with confirmation dialog, calls `deleteTeam` action.
*   **Form Handling**:
    *   `use:enhance` used for all actions.
    *   `handleAdminActionSubmit` function manages common logic for admin actions (invalidate data, update UI state).
    *   `handleCreateSuccess` function for create team specific UI updates.
*   **TypeScript/Linting**:
    *   `result: ActionResult` and `update` parameters in `use:enhance` callbacks are explicitly typed.
    *   The `(form as any)?.error` type assertion is used in the template for admin action feedback to accommodate varying `ActionData` shapes while still allowing access to a potential `error` field.

## Current Status & Next Steps

*   **Core Functionality Implemented**:
    *   Team creation is fully functional and secure.
    *   Team renaming by admins is implemented.
    *   Team deletion by admins is implemented (with cascading member removal).
    *   User invitation by email (direct add to `team_members`) by admins is implemented.
*   **RLS Policies**: All relevant RLS policies are in a secure and functional state.
*   **Frontend UI**: Basic UI for all implemented team management features is in place with feedback mechanisms.
*   **TypeScript**: Major type errors have been resolved.

**Immediate Next Steps / Areas for Review & Refinement:**

1.  **Full Invitation System & Notifications (Refined from TF FR2.1-FR2.3, FR2.2):**
    *   Modify the `inviteUser` action to create records in the `team_invitations` table instead of directly adding to `team_members`.
    *   Implement UI for users to view their pending invitations (e.g., in an account section or via a dedicated "Invitations" page/modal).
    *   Create server actions and corresponding UI for users to `accept` or `decline` team invitations.
    *   Integrate UI notifications (e.g., toasts/popups as per existing Next Step) for:
        *   Receiving a new team invitation.
        *   Successful/failed invitation acceptance/declination.
        *   Confirmation when an admin sends an invitation.

2.  **Comprehensive Team & Member Management (from TF FR1.3, FR1.5.1, FR2.5, FR2.6, FR2.7, FR2.8):**
    *   **Team Settings:**
        *   Implement a check for team name uniqueness per user during team creation and renaming, so that they can’t have multiple teams with the same name.
        *   Define and implement a clear strategy for handling associated data (items, entities, tags, notes) when a team is deleted (e.g., prompt user to move team data to another team or delete team and associated data). This will likely involve updating the `deleteTeam` action and RLS.
        A user can’t delete a team if it is the only one that he has, so that we can’t have orphaned users.
    *   **Member Management (UI and Actions):**
        *   UI for Team Admins to change the roles of existing team members.
        *   UI for Team Admins to remove members from the team.
        *   UI for non-admin members to voluntarily leave a team.
    *   **Edge Cases:**
        *   Implement logic to handle scenarios where the sole Admin/Owner attempts to leave the team or if their account is deleted (e.g., require ownership transfer or team deletion).

3.  **Active Team Context Switching (from TF FR4.1-FR4.3):**
    *   UI for users to select an "active" team context is already in the sidebar in app-sidebar.svelte and team-switcher.svelte.
    *   Implement state management (e.g., Svelte store, potentially persisted in `localStorage`) for the `activeTeamId`.
    *   Ensure all data displays (item lists, dashboards) and data creation forms are filtered by and associated with the `activeTeamId`.
    *   Provide a clear visual indicator of the currently active team in the UI.

4.  **New User Onboarding - Automatic Personal Team (from TF FR1.7):**
    *   Implement a mechanism (e.g., Supabase trigger on `auth.users` table insertion, or logic in the post-signup flow) to automatically create a "Personal Team" for every new user.
    *   The new user should be automatically set as the 'admin' of this personal team.

5.  **Role-Based Access Control (RBAC) Refinement & Testing (from TF FR2.4):**
    *   Thoroughly test and verify the permissions for `Admin`, `Editor`, and `Viewer` roles across all team-related functionalities (not just item CRUD).
    *   Ensure UI for assigning roles during invitation (and role changes) accurately reflects these defined roles.
    *   Clarify and document specific capabilities of `Editor` and `Viewer` roles beyond basic data access (e.g., can an editor see team member list but not manage them?).

6.  **Error Handling & User Feedback (Existing Next Step - Enhanced):**
    *   Continuously review and enhance user-facing error messages for clarity and helpfulness across all new and existing team actions.
    *   Ensure all edge cases identified (e.g., inviting non-existent users, sole admin issues) are gracefully handled and communicated.

7.  **UI/UX Polish (Existing Next Step - Enhanced):**
    *   Refine the styling, layout, and overall user experience of all team management forms, lists, and controls.
    *   Consider UX improvements like disabling buttons during form submissions, loading indicators, and intuitive navigation for team settings and member management.

8.  **Comprehensive Testing (Existing Next Step - Enhanced):**
    *   Conduct thorough testing of all implemented functionalities, including all points mentioned above (invitation flow, role permissions, team context switching, new user onboarding, edge cases).
    *   Test RLS policy enforcement rigorously.

9.  **Code Cleanup & Documentation (Existing Next Step - Enhanced):**
    *   Review code for any remaining TODOs, comments, or areas for refactoring.
    *   Update internal documentation (like this progress file) and consider if any user-facing guides are needed for team features.

## Phase 2: Refactor Data Association to `team_id` (Items, Entities, Tags, Notes)

This phase focuses on shifting the primary data association for core application entities from `user_id` to `team_id`, ensuring all data is correctly scoped within the active team context. The `user_id` column on these tables will be retained (e.g., for auditing "created by") but will no longer be the primary identifier for data segregation.

### 1. Objective

*   Transition `items`, `tags`, `entities`, and `item_notes` to be primarily owned and scoped by `team_id`.
*   Ensure `item_notes` are correctly associated with teams through their parent `item`'s `team_id`.
*   All data operations (listing, creation, updates, deletion) for these entities must be filtered and authorized based on the user's `activeTeamId` and their role within that team.
*   The `user_id` column on `items`, `entities`, `tags`, and `item_notes` will generally represent the "creator" or "last modifier" rather than the sole owner for data segregation.

### 2. Scope of Changes

*   **Database Interaction Functions (`src/lib/server/db/`)**:
    *   **`items.ts`**:
        *   Modify `listItemsForUser` (likely rename to `listItemsForTeam`), `createItem`, `updateItemWithRelations`, `deleteItemById`, and `getItemDetailById` (if it exists or is created) to accept `teamId` as a mandatory parameter.
        *   Queries will need to filter by `.eq('team_id', teamId)`.
        *   `createItem` and `updateItemWithRelations` must set the `team_id` on new/updated item records, in addition to `user_id` (for creator).
        *   The `_resolveEntity` helper within `items.ts` will also need to consider `teamId` when looking up entities.
    *   **`entities.ts`**:
        *   Modify `getEntitiesForUser` (rename to `getEntitiesForTeam`), `createEntity`, `updateEntity`, and `deleteEntity` to accept and use `teamId`.
        *   `createEntity` must set `team_id`.
    *   **`tags.ts`**:
        *   Modify `findOrCreateTagsForUser` (rename to `findOrCreateTagsForTeam`) and `syncItemTags` to operate within a specific `teamId`. Tags will become team-specific, not user-global.
        *   `findOrCreateTagsForTeam` must set `team_id` on new tags.
    *   **`notes.ts`**:
        *   Functions like `addNoteToItem`, `deleteNoteById`, `updateNoteById` will need to ensure the parent `item` (identified by `itemId`) belongs to the `activeTeamId`. This check might involve an additional query or ensuring the `itemId` passed is already verified against the active team.
        *   The `user_id` on `item_notes` will continue to represent the note's author. No `team_id` column exists on `item_notes`; association is indirect.

*   **SvelteKit Server Logic (`src/routes/app/.../+page.server.ts` for items, entities, etc.)**:
    *   Update `load` functions: Fetch the `activeTeamId` (from session, a store, or another established mechanism) and pass it to the updated database functions (e.g., `listItemsForTeam(supabase, activeTeamId)`).
    *   Update `actions` (e.g., `addItem`, `addEntity`, `updateItem`, `deleteItem`):
        *   Retrieve `activeTeamId`.
        *   Pass `activeTeamId` to respective database CUD functions.
        *   Ensure `session.user.id` is still passed for setting the creator/modifier `user_id`.

*   **Frontend Components & Active Team Context**:
    *   This refactoring is critically dependent on the "Active Team Context Switching" functionality (Phase 3 in `TEAMS_IMPLEMENTATION_PROGRESS.md`).
    *   Frontend components initiating data operations must have access to the `activeTeamId` (e.g., from a Svelte store populated upon team selection).
    *   Forms for creating items, entities, etc., will implicitly associate new data with the `activeTeamId` via the backend.

*   **RLS Policies Review**:
    *   The existing RLS policies for `items`, `entities`, `tags` (e.g., `USING (is_team_member(team_id, auth.uid()))`) are generally compatible, as they already expect a `team_id`.
    *   The primary change is ensuring the application code *consistently provides* the correct `team_id` for these policies to evaluate correctly, especially for `INSERT` and `UPDATE` `WITH CHECK` conditions.
    *   For `item_notes`, RLS will continue to rely on the user's access to the parent item.

### 3. Data Integrity & `user_id` Column Usage

*   **`items.user_id`, `entities.user_id`, `tags.user_id`**: These will continue to be populated with `session.user.id` upon creation. For `items`, this `user_id` will signify the "creator" of the record, allowing this information (e.g., creator's name/avatar) to be displayed to other team members. For all these entities, `user_id` will no longer be the primary key for data scoping but rather an attribute indicating creation or last modification.
*   **`item_notes.user_id`**: This will continue to represent the "author" of the note.
*   **Data Migration**: The initial migration script associated existing data with a "Personal Team". Any data created *after* that migration but *before* this refactor (if `team_id` was nullable and not set by application logic) might need a one-time update to ensure `team_id` is populated, likely defaulting to the user's personal/primary team.

### 4. Dependencies on Other Phases

*   Successful implementation of this phase is heavily reliant on **Phase 3: Active Team Context Switching** being in place, as `activeTeamId` is a prerequisite for most changes described here. These two phases may need to be developed in close conjunction.

## Phase 2: Refactor Data Association to `team_id` (Items, Entities, Tags, Notes)

### 1. Database Schema & RLS Adjustments

*   **`items`, `entities`, `tags` Tables**:
    *   The `team_id` column (added in Phase 1) is now the primary means of associating these records with a team.
    *   The `user_id` column is used to identify the creator of the record.
    *   **RLS Policies Updated**:
        *   Removed old policies that granted access based solely on `user_id` (e.g., "Allow individual read access", "Allow individual insert access", etc.).
        *   Existing team-based RLS policies (e.g., "Allow team members to view items", "Allow team editors and admins to create items") are now the primary controllers of access, using `team_id` and `get_user_role_in_team()` or `is_team_member()`.
*   **`item_tags` Table (Junction Table)**:
    *   Access to `item_tags` is implicitly controlled by access to the linked `items` and `tags` via their respective team-based RLS policies.
    *   **RLS Policies Updated**:
        *   Removed old policies that granted access based solely on the `user_id` of the associated item/tag creator (e.g., "Allow individual read access").
*   **`item_notes` Table (Formerly referred to as `notes` in some RLS contexts)**:
    *   The `item_id` column links a note to an item, which in turn has a `team_id`.
    *   The `user_id` column on `item_notes` identifies the author of the note.
    *   **RLS Policies Updated**:
        *   Retained existing policies allowing authors direct CRUD access to their own notes (e.g., `USING (auth.uid() = user_id)`).
        *   **Added new team-based policies**:
            *   `SELECT`: "Allow team members to view item_notes for their team" - Allows any member of the item's team to view its notes.
            *   `INSERT`: "Allow team editors and admins to create item_notes for their team" - Allows editors/admins of the item's team to add notes (author is set to `auth.uid()`).
            *   `UPDATE`: "Allow team editors and admins to update item_notes in their team" - Allows editors/admins of the item's team to update any note on that item.
            *   `DELETE`: "Allow team editors and admins to delete item_notes in their team" - Allows editors/admins of the item's team to delete any note on that item.

### 2. Backend Code Refactoring (SvelteKit Server & DB Functions)

*   **`src/lib/server/db/items.ts`**:
    *   `listItemsForUser` -> `listItemsForTeam(supabase, teamId)`: Filters items by `team_id`.
    *   `getItemByIdForUser` -> `getItemByIdForTeam(supabase, itemId, teamId)`: Fetches item ensuring it belongs to `teamId`.
    *   `createItem`: Now requires `teamId` and `creatorUserId`.
    *   `updateItemWithRelations`: Now requires `teamId` and `modifierUserId` in its payload.
    *   `deleteItemById`: Now requires `teamId` to ensure the item belongs to the team before deletion (though RLS is primary enforcement).
*   **`src/lib/server/db/tags.ts`**:
    *   `findOrCreateTagsForUser` -> `findOrCreateTagsForTeam(supabase, teamId, creatorUserId, tagNames)`: Scopes tag creation/finding to `teamId`.
    *   `syncItemTags`: Now requires `teamId` and `creatorUserId` (for new tags).
*   **`src/lib/server/db/entities.ts`**:
    *   `getEntitiesForUser` -> `getEntitiesForTeam(supabase, teamId)`: Filters entities by `team_id`.
    *   `createEntity`: Now requires `teamId` and `creatorUserId`.
    *   `updateEntity`: Now requires `teamId` and `modifierUserId`.
    *   `deleteEntity`: Now requires `teamId`.
*   **`src/lib/server/db/notes.ts` (operates on `item_notes` table)**:
    *   `addNoteToItem`: Now requires `teamId` (to verify item's team) and `authorUserId` (for `item_notes.user_id`).
    *   `deleteNoteById`, `updateNoteById`: Continue to use `userId` (author's ID) for direct note ownership checks, while team-level access is ensured by RLS and calling context (page `load` verifying item access via team).

### 3. Frontend SvelteKit `+page.server.ts` Refactoring

*   **`src/routes/app/items/+page.server.ts`**:
    *   `load`: Fetches items and entities using `activeTeam.id`.
    *   `actions.addItem`, `actions.deleteItem`: Use `activeTeam.id` and pass `session.user.id` as `creatorUserId` or for validation where appropriate.
*   **`src/routes/app/items/[itemId]/+page.server.ts`**:
    *   `load`: Fetches item details and entities using `activeTeam.id`.
    *   `actions.addNote`: Uses `activeTeam.id` (for item validation) and `session.user.id` as `authorUserId`.
    *   `actions.updateItem`: Uses `activeTeam.id` and `session.user.id` as `modifierUserId`.
    *   `actions.deleteNote`, `actions.updateNote`: Rely on `activeTeam.id` check for page access and `session.user.id` for note authorship checks in DB functions.
*   **`src/routes/app/entities/+page.server.ts`**:
    *   `load`: Fetches entities using `activeTeam.id`.
    *   `actions.addEntity`, `actions.updateEntity`, `actions.deleteEntity`: Use `activeTeam.id` and pass `session.user.id` as `creatorUserId` or `modifierUserId` as appropriate.

### 4. Dependencies on Other Phases