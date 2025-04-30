import { fail, redirect, type ActionFailure } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Provider, SupabaseClient } from '@supabase/supabase-js'
import type { RequestEvent } from '@sveltejs/kit'

// Define OAuth providers
const OAUTH_PROVIDERS: Provider[] = ['github', 'google']

// Helper type for the data returned by form actions, especially on failure
type FormFailureData = {
    message: string;
    values?: { email?: string };
    errorField?: 'email' | 'password' | 'passwordConfirm' | 'general';
    isSignUp?: boolean;
    success?: boolean;
};

// Helper type for the Action event
type ActionEvent = RequestEvent & { locals: { supabase: SupabaseClient } };
// Define ActionResult using the specific failure data type
type ActionResult = Promise<ActionFailure<FormFailureData> | void>;


export const actions: Actions = {
  login: async ({ request, locals: { supabase }, url }: ActionEvent): ActionResult => {
    const formData = await request.formData()
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email) {
        return fail(400, { message: 'Email is required.', values: { email }, errorField: 'email' })
    }
    if (!password) {
        return fail(400, { message: 'Password is required.', values: { email }, errorField: 'password' })
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.error('Login error:', error.message)
      // Return generic error to avoid leaking information
      return fail(401, { message: 'Invalid credentials.', values: { email }, errorField: 'general' })
    }

    redirect(303, '/app')
  },

  register: async ({ request, locals: { supabase }, url }: ActionEvent): ActionResult => {
    const formData = await request.formData()
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const passwordConfirm = formData.get('passwordConfirm') as string

    // --- Validation --- BEGIN
    if (!email) {
        return fail(400, { message: 'Email is required.', values: { email }, errorField: 'email', isSignUp: true })
    }
    if (!password) {
        return fail(400, { message: 'Password is required.', values: { email }, errorField: 'password', isSignUp: true })
    }
    if (!passwordConfirm) {
        return fail(400, { message: 'Please confirm your password.', values: { email }, errorField: 'passwordConfirm', isSignUp: true })
    }
    if (password !== passwordConfirm) {
        return fail(400, { message: 'Passwords do not match.', values: { email }, errorField: 'passwordConfirm', isSignUp: true })
    }
    // Optional: Add more robust password strength validation here
    // if (password.length < 8) { ... }
    // --- Validation --- END

    // Check Supabase docs for options: https://supabase.com/docs/reference/javascript/auth-signup
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // emailRedirectTo: `${url.origin}/auth/callback`, // Default from Supabase UI?
        // For PKCE flow (recommended), the confirmation link should point to /auth/confirm
        emailRedirectTo: `${url.origin}/auth/confirm`,
        // data: { custom_field: 'value' } // Optional: store extra data about the user
      },
    })

    if (error) {
      console.error('Sign up error:', error.status, error.message)
      if (error.status === 400 && error.message.includes('validate email format')) {
            return fail(400, { message: 'Invalid email format.', values: { email }, errorField: 'email', isSignUp: true })
      } else if (error.status === 400 && error.message.includes('should be at least 6 characters')) {
           return fail(400, { message: 'Password should be at least 6 characters.', values: { email }, errorField: 'password', isSignUp: true })
      } else if (error.status === 422 && error.message.includes('User already registered')) {
          // Note: Supabase might return 422 for existing user based on config
          return fail(409, { message: 'User already exists. Try signing in.', values: { email }, errorField: 'email', isSignUp: true })
      }
      // Generic failure
      return fail(500, { message: 'Could not register user. Please try again later.', values: { email }, errorField: 'general', isSignUp: true })
    }

    // Success -> Redirect to check email page
    redirect(303, '/auth/check-email')
  },

  reset_password: async ({ request, locals: { supabase }, url }: ActionEvent): ActionResult => {
    const formData = await request.formData()
    const email = formData.get('email') as string

    if (!email) {
        return fail(400, { message: 'Email is required.', values: { email }, errorField: 'email' })
    }

    // Ensure redirectTo points to the PKCE confirmation endpoint
    const redirectUrl = `${url.origin}/auth/confirm?next=/auth/update-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      })

    if (error) {
        // Log error but don't inform the user to prevent email enumeration
        console.error('Password reset error:', error.message)
    }

    // Always redirect to the same page regardless of whether the email exists or not
    // Optionally, return a success message even on error to obscure if email exists
    // return { success: true, message: 'If an account exists for this email, a reset link has been sent.' };
    redirect(303, '/auth/check-email-reset')
  },

  oauth_login: async ({ locals: { supabase }, url, request }: ActionEvent): ActionResult => {
    const formData = await request.formData();
    const provider = formData.get('provider') as Provider | null;

    if (!provider || !OAUTH_PROVIDERS.includes(provider)) {
      return fail(400, { message: 'Invalid OAuth provider.', errorField: 'general' })
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${url.origin}/auth/callback`,
        // scopes: '...', // Optional: Request specific provider scopes
      },
    });

    if (error) {
      console.error('OAuth error:', error);
      return fail(500, { message: 'OAuth login failed. Please try again.', errorField: 'general' })
    }

    redirect(303, data.url);
  }
} 