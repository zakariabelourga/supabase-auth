import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
  // Grab the session from locals
  const { session, user } = await safeGetSession()

  // Return the session and user so it's available to the client
  // Also return cookies so the client-side Supabase instance can read them
  return {
    session,
    user, // Optional: expose the user object as well
    // Pass all cookies (needed for client-side client)
    // You might want to filter this in a production app for security/performance
    cookies: cookies.getAll(), 
  }
} 