import type { SupabaseClient, Session } from '@supabase/supabase-js';

// Basic linked entity, often used in relationships
export interface LinkedEntity {
    id: string;
    name: string;
    team_id: string | null; // Added team_id
}

// Full Entity definition (includes fields from entities page)
export interface Entity {
    id: string;
    name: string;
    description: string | null;
    created_at: string; // ISO date string
    team_id: string | null; // Added team_id
}

// Category definition
export interface Category {
    id: string;
    name: string;
}

// Tag definition
export interface Tag {
    id: string;
    name: string;
    team_id: string | null; // Added team_id
}

// Item Note definition
export interface ItemNote {
    id: string;
    note_text: string;
    created_at: string; // ISO date string
    updated_at: string; // ISO date string
    // user_id is implicitly handled by RLS or set in server actions
}

// Item definition for lists and forms (structure from items/+page.server.ts and items/+page.svelte)
export interface ItemEntry {
    id: string;
    name: string;
    description: string | null;
    expiration: string; // Stored as date, retrieved as string (ISO date string)
    created_at: string; // ISO date string
    updated_at: string; // ISO date string
    category: Category | null;
    tags: Tag[];
    entity: LinkedEntity | null; // Linked entity from 'entities' table
    entity_name_manual: string | null; // Manually entered name if no link
    team_id: string | null; // Added team_id
}

// Detailed Item definition (used for single item view, includes notes - structure from items/[itemId]/+page.server.ts)
export interface ItemDetail extends ItemEntry {
    item_notes: ItemNote[];
    params?: Partial<Record<string, string>>; // params can be optional
}

// --- New Team-related Types ---

// Enum for Team Roles
export type TeamRole = 'admin' | 'editor' | 'viewer';

// Enum for Invitation Status
export type InvitationStatus = 'pending' | 'accepted' | 'declined';

// Team definition
export interface Team {
    id: string; // uuid
    name: string;
    owner_user_id: string; // uuid, FK to auth.users.id
    created_at: string; // timestamptz
    updated_at: string; // timestamptz
}

// Team Member definition
export interface TeamMember {
    team_id: string; // uuid, FK to teams.id
    user_id: string; // uuid, FK to auth.users.id
    role: TeamRole;
    joined_at: string; // timestamptz
    // Optional: include user details like name/email if often fetched together
    // user?: { id: string; email?: string; /* other profile fields */ };
}

// Team Invitation definition
export interface TeamInvitation {
    id: string; // uuid
    team_id: string; // uuid, FK to teams.id
    email_invited: string;
    invited_by_user_id: string; // uuid, FK to auth.users.id
    status: InvitationStatus;
    created_at: string; // timestamptz
    accepted_at: string | null; // timestamptz
    // Optional: include additional details if needed for UI
    // team?: { name?: string };
    // invited_by_user?: { email?: string };
}

// Active Team definition (a Team with the current user's role in it)
export interface ActiveTeam extends Team {
    role: TeamRole; // User's role in this specific team
}