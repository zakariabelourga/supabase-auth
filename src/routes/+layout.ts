import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr'
import type { LayoutLoad } from './$types'

// IMPORTANT: Replace with your actual Supabase URL and Anon Key
// You can also use environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
  /**
   * Declare a dependency so the layout can be invalidated, for example, on
   * session refresh.
   */
  depends('supabase:auth')

  const supabase = isBrowser()
    ? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: {
          fetch,
        },
      })
    : createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: {
          fetch,
        },
        cookies: {
          // Pass server cookies to the client-side client
          getAll() {
            return data.cookies
          },
        },
      })

  /**
   * It's recommended to use `getUser()` on the client to ensure you have the
   * latest session information validated against the server. 
   * `getSession()` is faster as it reads from storage, but might be stale.
   * We prioritize the server-validated data from `+layout.server.ts` (`data.session`, `data.user`)
   * but also fetch client-side user data to align with Supabase examples and potentially satisfy warnings.
   */
  const {
    data: { session: clientSession }, // Get session info from storage
  } = await supabase.auth.getSession()
  
  const {
      data: { user: clientUser }, // Get validated user from server
  } = await supabase.auth.getUser()

  // Prioritize server-validated data passed via `+layout.server.ts`
  const session = data.session ?? clientSession
  // Prioritize server user, fallback to client user if server user is null for some reason
  const user = data.user ?? clientUser 

  return { 
    session, // Pass down the prioritized session
    supabase, // Pass Supabase client down
    user // Pass down the prioritized user
   }
} 