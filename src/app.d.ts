// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
// Uncomment the line below if you have generated database types
 import type { Database } from './lib/supabase.ts' 

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			// Use 'any' if you haven't generated types, or 'Database' if you have
			supabase: SupabaseClient<Database>
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>
			session: Session | null
			user: User | null
		}
		interface PageData {
			session: Session | null
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
