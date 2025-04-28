import { fail, redirect, type ActionFailure } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Provider, SupabaseClient } from '@supabase/supabase-js'
import type { RequestEvent } from '@sveltejs/kit'

// Optional: Define OAuth providers
const OAUTH_PROVIDERS: Provider[] = ['github', 'google'] // Add providers you want to support

// Helper type for form actions
type ActionEvent = RequestEvent & { locals: { supabase: SupabaseClient } }
type ActionResult = Promise<ActionFailure<{ message: string; values?: { email?: string } }> | void>

export const actions: Actions = {
  login: async ({ request, locals: { supabase }, url }: ActionEvent): ActionResult => {
    const formData = await request.formData()
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
        return fail(400, { message: 'Email and password are required.', values: { email } })
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.error('Login error:', error.message)
      // Return generic error to avoid leaking information
      return fail(401, { message: 'Invalid credentials.', values: { email } })
    }

    // Successful login, redirect to a protected route (e.g., /private)
    redirect(303, '/private')
  },
  register: async ({ request, locals: { supabase }, url }: ActionEvent): ActionResult => {
    const formData = await request.formData()
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
        return fail(400, { message: 'Email and password are required.', values: { email } })
    }

    // Add password strength validation here if needed

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Optional: Email confirmation redirect URL
        emailRedirectTo: `${url.origin}/auth/callback`, 
      },
    })

    if (error) {
      console.error('Sign up error:', error.message)
      // Check for specific errors, like user already exists
      if (error.message.includes('User already registered')) {
          return fail(409, { message: 'User already exists.', values: { email } })
      }
      return fail(500, { message: 'Could not register user.', values: { email } })
    }

    // Registration successful (or requires email confirmation)
    // Redirect to a page indicating success or asking to check email
    redirect(303, '/auth/check-email') // Or redirect directly to /private if email confirmation is off
  },
  reset_password: async ({ request, locals: { supabase }, url }: ActionEvent): ActionResult => {
    const formData = await request.formData()
    const email = formData.get('email') as string

    if (!email) {
        return fail(400, { message: 'Email is required.', values: { email } })
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${url.origin}/auth/callback`,
      })

    if (error) {
        console.error('Password reset error:', error.message)
        // Don't reveal if email exists or not
        // return fail(500, { message: 'Error sending reset link.', values: { email } })
    }

    // Even if there was an error (e.g., email not found), act like it succeeded
    // Redirect to a confirmation page
    redirect(303, '/auth/check-email-reset')
  },
  // Optional: OAuth login action
  oauth_login: async ({ locals: { supabase }, url, request }: ActionEvent): ActionResult => {
    const formData = await request.formData();
    const provider = formData.get('provider') as Provider | null;

    if (!provider || !OAUTH_PROVIDERS.includes(provider)) {
      return fail(400, { message: 'Invalid OAuth provider.' })
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${url.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error('OAuth error:', error);
      return fail(500, { message: 'OAuth login failed. Please try again.' })
    }

    // Redirect to the provider's auth page
    redirect(303, data.url);
  }
} 