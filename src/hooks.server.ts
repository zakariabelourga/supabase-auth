import { createServerClient } from '@supabase/ssr'
import { type Handle, redirect } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'

// IMPORTANT: Replace with your actual Supabase URL and Anon Key
// You can also use environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

const supabase: Handle = async ({ event, resolve }) => {
  /**
   * Creates a Supabase client specific to this server request.
   *
   * The Supabase client gets the Auth token from the request cookies.
   */
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      /**
       * SvelteKit's cookies API requires `path` to be explicitly set in
       * the cookie options. Setting `path` to `/` replicates previous/
       * standard behavior.
       */
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, { ...options, path: '/' })
        })
      },
    },
  })

  /**
   * Unlike `supabase.auth.getSession()`, which returns the session _without_
   * validating the JWT, this function also calls `getUser()` to validate the
   * JWT before returning the session.
   */
  event.locals.safeGetSession = async () => {
    const {
      data: { session },
    } = await event.locals.supabase.auth.getSession()
    if (!session) {
      return { session: null, user: null }
    }

    const {
      data: { user },
      error,
    } = await event.locals.supabase.auth.getUser()
    if (error) {
      // JWT validation has failed
      return { session: null, user: null }
    }

    return { session, user }
  }

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      /**
       * Supabase libraries use the `content-range` and `x-supabase-api-version`
       * headers, so we need to tell SvelteKit to pass it through.
       */
      return name === 'content-range' || name === 'x-supabase-api-version'
    },
  })
}

const authGuard: Handle = async ({ event, resolve }) => {
  const { session, user } = await event.locals.safeGetSession()
  event.locals.session = session
  event.locals.user = user

  // Define protected paths
  const protectedPaths = ['/app'] // Add any other paths you want to protect
  const isProtectedRoute = protectedPaths.some(path => event.url.pathname.startsWith(path))

  // Define auth path prefix and specific auth routes allowed even when logged in
  const authPathPrefix = '/auth'
  const allowedAuthRoutesWhenLoggedIn = [
    '/auth/confirm', 
    '/auth/update-password'
    // Add /auth/logout or other necessary routes here if applicable
  ]

  if (!event.locals.session && isProtectedRoute) {
    // If not logged in and trying to access a protected route, redirect to the main auth page (or login)
    redirect(303, authPathPrefix) // Or keep as authPathPrefix if /auth is your main entry
  }

  // Check if the user is logged in AND trying to access an auth route
  if (event.locals.session && event.url.pathname.startsWith(authPathPrefix)) {
    // Check if the specific auth route is one that should NOT be accessed when logged in (e.g., login, signup)
    if (!allowedAuthRoutesWhenLoggedIn.includes(event.url.pathname)) {
      // If logged in and trying to access a non-allowed auth route, redirect to /app
      redirect(303, '/app') // Adjust the redirect path as needed
    }
    // Otherwise, allow access to routes like /auth/update-password even if logged in
  }

  return resolve(event)
}

// Sequence the handlers
export const handle: Handle = sequence(supabase, authGuard) 