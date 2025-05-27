# Teams Functionality: Functional Requirements & Implementation Plan

## 1. Overview

Introduce a "Teams" functionality to the expiration manager application. This will allow users to create or join teams, and all items (expirations, documents, etc.), categories, entities, and tags will be shared and managed within the context of a team, rather than belonging to individual users.

## 2. Functional Requirements

### 2.1. Team Management
    - **FR1.1:** Authenticated users shall be able to create a new team.
    - **FR1.2:** The creator of a team shall be designated as the team's initial "Owner" or "Admin".
    - **FR1.3:** Each team must have a unique name (within the scope of teams owned by a user, or globally, TBD - recommend globally for simplicity or prefix with owner info).
    - **FR1.4:** Team Admins shall be able to rename their team.
    - **FR1.5:** Team Admins shall be able to delete their team.
        - **FR1.5.1:** Deletion of a team should handle associated items (e.g., archive items, prompt for transfer, or hard delete with warning).
    - **FR1.6:** Users shall be able to view a list of all teams they are a member of.
    - **FR1.7 (New/Emphasis):** Every new user shall have a "personal" team automatically created upon account creation, with the user set as the Admin. (Covered for existing users in FR5.2)

### 2.2. Team Membership & Roles
    - **FR2.1:** Team Admins shall be able to invite other registered users to join their team (e.g., via email or username).
    - **FR2.2:** Invited users shall receive a notification/invitation.
    - **FR2.3:** Invited users shall be able to accept or decline team invitations.
    - **FR2.4:** The system shall support at least the following roles for team members:
        - `Admin`: Full control over team settings, members, and all items/data within the team.
        - `Editor`: Can create, read, update, and delete items/data within the team. Cannot manage team settings or members.
        - `Viewer`: Can only read items/data within the team. Cannot make changes.
    - **FR2.5:** Team Admins shall be able to assign and change roles for team members.
    - **FR2.6:** Team Admins shall be able to remove members from the team.
    - **FR2.7:** Team members (non-admins) shall be able to voluntarily leave a team.
    - **FR2.8:** If the sole Admin/Owner attempts to leave, they must either transfer ownership or delete the team.

### 2.3. Item & Data Management within Teams
    - **FR3.1:** All `items` (expirations) shall be associated with a specific team.
    - **FR3.2 (Updated):** `Categories` shall be global and accessible across all users and teams. They are not associated with a specific team.
    - **FR3.3:** All `entities` shall be associated with a specific team.
    - **FR3.4:** All `tags` shall be associated with a specific team.
    - **FR3.5:** CRUD (Create, Read, Update, Delete) operations on items, entities, and tags shall be governed by the user's role within the respective team.
    - **FR3.6:** `Item notes` will still be authored by individual users, but their visibility will be tied to the parent item's team access.

### 2.4. Team Context & UI
    - **FR4.1:** Users who are members of multiple teams shall be able to select an "active" team context.
    - **FR4.2:** The application UI (item lists, forms, dashboards) shall display data relevant only to the currently active team.
    - **FR4.3:** A clear visual indicator of the currently active team shall be present in the UI.

### 2.5. Data Migration (for Existing Users)
    - **FR5.1:** A migration path shall be provided for existing users and their data.
    - **FR5.2:** For each existing user, a new "personal" team shall be automatically created (e.g., during the first login post-update or via a backend script).
    - **FR5.3:** The user shall be designated as the Admin of their new personal team.
    - **FR5.4:** All existing items, entities, and tags previously owned by the user (as indicated by their `user_id`) shall be migrated and associated with their new personal team by populating the new `team_id` field. The existing `user_id` field remains populated.
    - **FR5.5:** Categories will not require migration to teams as they are global.

## 3. Proposed Database Schema Changes (Supabase)

### 3.1. New Tables

*   **`teams`**
    *   `id`: `uuid` (Primary Key, default: `uuid_generate_v4()`)
    *   `name`: `text` (Not Null)
    *   `owner_user_id`: `uuid` (Foreign Key to `auth.users.id` or `public.profiles.id`, Not Null)
    *   `created_at`: `timestamptz` (default: `now()`)
    *   `updated_at`: `timestamptz` (default: `now()`)

*   **`team_members`** (Junction table)
    *   `team_id`: `uuid` (Foreign Key to `teams.id`, Part of Composite Primary Key)
    *   `user_id`: `uuid` (Foreign Key to `auth.users.id` or `public.profiles.id`, Part of Composite Primary Key)
    *   `role`: `team_role` (Enum: 'admin', 'editor', 'viewer', Not Null)
    *   `joined_at`: `timestamptz` (default: `now()`)

*   **(Optional) `team_invitations`**
    *   `id`: `uuid`
    *   `team_id`: `uuid` (FK to `teams.id`)
    *   `email_invited`: `text` (or `invited_user_id` if inviting existing users by ID)
    *   `invited_by_user_id`: `uuid` (FK to `auth.users.id`)
    *   `status`: `text` (Enum: 'pending', 'accepted', 'declined')
    *   `created_at`: `timestamptz`
    *   `expires_at`: `timestamptz`

### 3.2. Modifications to Existing Tables

*   **`items` table:**
    *   **Keep:** `user_id` column (for rollback, to be deprecated).
    *   **Add:** `team_id`: `uuid` (Foreign Key to `teams.id`, Nullable initially for migration, then Not Null).
*   **`categories` table:**
    *   **No Change for Teams:** This table will not have `team_id` added. It remains global. Existing `user_id` (if any, for creator/audit purposes, not for data segregation) can be kept or managed as per global requirements.
*   **`entities` table:**
    *   **Keep:** `user_id` column (for rollback, to be deprecated).
    *   **Add:** `team_id`: `uuid` (Foreign Key to `teams.id`, Nullable initially for migration, then Not Null).
*   **`tags` table:**
    *   **Keep:** `user_id` column (for rollback, to be deprecated).
    *   **Add:** `team_id`: `uuid` (Foreign Key to `teams.id`, Nullable initially for migration, then Not Null).
*   **`item_notes` table:**
    *   `user_id` remains (author of the note). Association to team is via `item_id`.

### 3.3. Row Level Security (RLS)
    - RLS policies must be updated/created for all affected tables (`teams`, `team_members`, `items`, `entities`, `tags`) to enforce team-based access and role permissions.

## 4. Implementation Plan

### Phase 1: Backend Setup (Supabase & Server-side SvelteKit)
    1.  **Database Schema Implementation:**
        *   Create migration scripts for new tables (`teams`, `team_members`, `team_invitations` (optional)).
        *   Create migration scripts to modify existing tables (`items`, `entities`, `tags`) by adding `team_id`. The existing `user_id` columns on these tables will be kept for rollback purposes and marked as deprecated.
        *   The `categories` table will not be modified to include `team_id`.
        *   Define and apply RLS policies. RLS for `categories` will be based on global access rather than team membership.
    2.  **Type Generation:**
        *   Update Supabase type definitions (`src/lib/supabase.ts`) using `supabase gen types typescript`.
        *   Update custom types in `src/lib/types.ts`. (e.g., `Category` type will not have `team_id`).
    3.  **Data Migration Strategy & Script:**
        *   Develop a script (e.g., Supabase Edge Function or local script) to:
            *   Iterate through existing users.
            *   Create a "personal" team for each user if one doesn't exist.
            *   Assign the user as admin to this team.
            *   Update existing `items`, `entities`, `tags` by populating their new `team_id` field based on the original `user_id`'s corresponding personal team. The original `user_id` field remains populated.
        *   Categories do not need migration related to teams.
        *   Execute this script once after schema changes are deployed.
    4.  **Server-Side API Endpoints (SvelteKit `+page.server.ts` / dedicated API routes):**
        *   **Teams API:** Endpoints for CRUD operations on teams (create, read user's teams, read team details, update, delete).
        *   **Team Members API:** Endpoints for inviting, accepting/declining invitations, updating roles, removing members, leaving teams.
        *   **Modify Existing Data Endpoints:** Update all `load` functions and form actions for items, categories, etc., to:
            *   Filter data by an `activeTeamId` (passed from client or determined from user's context).
            *   Ensure write operations (create, update, delete) are associated with the correct `activeTeamId`.
            *   Respect RLS implicitly through Supabase client calls.

### Phase 2: Frontend Implementation (SvelteKit UI)
    1.  **Team Context Management:**
        *   Implement UI for team selection/switching (e.g., a dropdown in `src/routes/app/+layout.svelte`).
        *   Store and manage `activeTeamId` (e.g., Svelte store, `localStorage`).
            *   The "personal" team can be the default active team.
        *   Ensure `activeTeamId` is passed to relevant `load` functions and components.
    2.  **Team Management UI:**
        *   Create new Svelte pages/components for:
            *   `/app/teams`: Listing teams, "Create New Team" button.
            *   `/app/teams/[teamId]`: Dashboard/view for a specific team (could redirect to items list filtered by this team).
            *   `/app/teams/[teamId]/settings`: Team name editing, member management (invite, change roles, remove).
            *   UI for handling team invitations (notifications, accept/decline options).
    3.  **Update Existing UI:**
        *   `src/routes/app/items/+page.svelte` (and other item-related views):
            *   Ensure data is loaded and displayed based on `activeTeamId`.
            *   Forms for adding/editing items must associate them with the `activeTeamId`.
        *   Update UI for categories, entities, tags to be team-aware (except categories, which are global).
    4.  **User Profile/Account Section:**
        *   Add a section to display pending team invitations.

### Phase 3: Testing & Refinement
    1.  **Comprehensive Testing:**
        *   Role-based access: Test all operations (CRUD on items, team management) for each role (Admin, Editor, Viewer).
        *   Team switching: Ensure context changes correctly.
        *   Invitation flow.
        *   Data migration for existing users.
        *   RLS enforcement.
    2.  **User Experience (UX) Review:**
        *   Clarity of active team context.
        *   Intuitive navigation for team management.
        *   Performance with team-filtered data.
    3.  **Documentation:**
        *   Update any user-facing documentation.

## 5. Key Files & Modules Impacted (Illustrative)

*   **Database:** Supabase schema, RLS policies, migration scripts.
*   **Types:** `src/lib/supabase.ts`, `src/lib/types.ts`. (Note: `Category` type will not include `team_id`).
*   **Layouts:** `src/routes/app/+layout.svelte`, `src/routes/app/+layout.ts`, `src/routes/+layout.server.ts` (potentially for team context).
*   **Item Management:** `src/routes/app/items/**` (all files).
*   **Entity Management:** `src/routes/app/entities/**` (all files, assuming similar structure to items).
*   **Category Management:** Logic for fetching/displaying categories will reflect their global nature.
*   **Account/Auth:** Potentially `src/routes/auth/**` or `src/routes/app/account/**` for invitation handling and ensuring new users get a default team.
*   **New Routes:**
    *   `src/routes/app/teams/+page.svelte` / `+page.server.ts`
    *   `src/routes/app/teams/[teamId]/settings/+page.svelte` / `+page.server.ts`
*   **Components:** New components for team switcher, member lists, invitation cards, etc.
*   **Stores:** Svelte stores for managing active team state, user's teams list.

## 6. Future Considerations (Post-MVP)

*   Team-specific settings/preferences.
*   Audit logs for team activities.
*   Notifications for team events (e.g., new item added, item expiring soon within the team).
*   Advanced role/permission system if needed.
