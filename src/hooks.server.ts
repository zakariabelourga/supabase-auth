import { createServerClient } from '@supabase/ssr'
import { type Handle, redirect } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public' //env/static/public Known linter error with SvelteKit
import { getAllTeamsForUser, getTeamMemberRole } from '$lib/server/db/teams'
import type { Team, ActiveTeam, TeamRole } from '$lib/types'

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

const activeTeamHook: Handle = async ({ event, resolve }) => {
  console.log('[Hooks] activeTeamHook: Starting');
  if (!event.locals.user || !event.locals.supabase) {
    console.log('[Hooks] activeTeamHook: No user or supabase in locals. Setting teams/activeTeam to null.');
    event.locals.teams = null;
    event.locals.activeTeam = null;
    return resolve(event);
  }

  const { user, supabase } = event.locals;
  console.log('[Hooks] activeTeamHook: User ID:', user.id);
  let activeTeamIdFromCookie = event.cookies.get('active_team_id');
  console.log('[Hooks] activeTeamHook: Active Team ID from cookie:', activeTeamIdFromCookie);

  // Fetch all teams for the user
  const teamsResult = await getAllTeamsForUser(supabase, user.id);
  console.log('[Hooks] activeTeamHook: getAllTeamsForUser result:', JSON.stringify(teamsResult, null, 2));

  if (teamsResult.success && teamsResult.data) {
    event.locals.teams = teamsResult.data;
    console.log('[Hooks] activeTeamHook: event.locals.teams set to:', JSON.stringify(event.locals.teams, null, 2));
  } else {
    event.locals.teams = []; // Default to empty array if fetch fails or no teams
    console.error('[Hooks] activeTeamHook: Failed to fetch teams or no teams found:', teamsResult.error);
    console.log('[Hooks] activeTeamHook: event.locals.teams set to empty array.');
  }

  let finalActiveTeam: ActiveTeam | null = null;

  if (event.locals.teams && event.locals.teams.length > 0) {
    console.log('[Hooks] activeTeamHook: User has teams. Count:', event.locals.teams.length);
    let targetTeam: Team | undefined = undefined;

    if (activeTeamIdFromCookie) {
      targetTeam = event.locals.teams.find(t => t.id === activeTeamIdFromCookie);
      console.log('[Hooks] activeTeamHook: Target team from cookie ID:', JSON.stringify(targetTeam, null, 2));
      if (!targetTeam) {
        console.warn(`[Hooks] activeTeamHook: Active team ID ${activeTeamIdFromCookie} from cookie not found in user's teams. Clearing cookie.`);
        event.cookies.delete('active_team_id', { path: '/' });
        activeTeamIdFromCookie = undefined; // Fall through to default selection
      }
    }

    // If no valid active team from cookie, or cookie was cleared, try to set the first team as active
    if (!targetTeam) {
      console.log('[Hooks] activeTeamHook: No target team from cookie, or cookie cleared. Attempting to set default.');
      targetTeam = event.locals.teams[0];
      if (targetTeam) {
        console.log(`[Hooks] activeTeamHook: Setting first team ${targetTeam.id} as active by default.`);
        event.cookies.set('active_team_id', targetTeam.id, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      } else {
        console.log('[Hooks] activeTeamHook: No teams available to set as default.');
      }
    }

    if (targetTeam) {
      console.log('[Hooks] activeTeamHook: Final targetTeam to get role for:', JSON.stringify(targetTeam, null, 2));
      const roleResult = await getTeamMemberRole(supabase, targetTeam.id, user.id);
      console.log('[Hooks] activeTeamHook: getTeamMemberRole result:', JSON.stringify(roleResult, null, 2));
      if (roleResult.success && roleResult.data) {
        finalActiveTeam = {
          ...targetTeam,
          role: roleResult.data as TeamRole 
        };
      } else {
        console.error(`[Hooks] activeTeamHook: Failed to get role for user ${user.id} in team ${targetTeam.id}:`, roleResult.error);
      }
    }
  } else {
    console.log('[Hooks] activeTeamHook: User has no teams (event.locals.teams is empty or null).');
  }

  event.locals.activeTeam = finalActiveTeam;
  console.log('[Hooks] activeTeamHook: event.locals.activeTeam set to:', JSON.stringify(event.locals.activeTeam, null, 2));
  console.log('[Hooks] activeTeamHook: Ending');

  return resolve(event);
};

// Sequence the handlers
export const handle: Handle = sequence(supabase, authGuard, activeTeamHook)