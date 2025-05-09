import type { SupabaseClient, Session } from '@supabase/supabase-js';

// Basic linked entity, often used in relationships
export interface LinkedEntity {
    id: string;
    name: string;
}

// Full Entity definition (includes fields from entities page)
export interface Entity {
    id: string;
    name: string;
    description: string | null;
    created_at: string; // ISO date string
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
}

// Detailed Item definition (used for single item view, includes notes - structure from items/[itemId]/+page.server.ts)
export interface ItemDetail extends ItemEntry {
    item_notes: ItemNote[];
}

// Event type for SvelteKit server functions with Supabase locals
export type AuthenticatedEvent = {
    locals: {
        supabase: SupabaseClient;
        session: Session | null;
    };
    request: Request;
    params?: Partial<Record<string, string>>; // params can be optional
};