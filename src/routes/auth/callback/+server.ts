import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { EmailOtpType } from '@supabase/supabase-js'

export const GET: RequestHandler = async ({ url, locals: { supabase } }: { url: URL; locals: { supabase: any } }) => {
  const code = url.searchParams.get('code')
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = url.searchParams.get('next') ?? '/private' // Default redirect after success

  // Create a redirect URL that removes the auth params
  const redirectTo = new URL(url)
  redirectTo.pathname = next
  redirectTo.searchParams.delete('code')
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('type')
  redirectTo.searchParams.delete('next')

  // Handle OAuth code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      redirect(303, redirectTo)
    }
    console.error('OAuth code exchange error:', error?.message)
    // Fall through to error redirect
  }
  // Handle Email link verification (signup, recovery, invite, magiclink, email_change)
  else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
       // If the type is recovery (password reset), redirect to the update password page
       if (type === 'recovery') {
         redirectTo.pathname = '/auth/update-password';
         redirect(303, redirectTo);
       }
       // For email change, we might handle differently or just redirect
       if (type === 'email_change') {
            // Optionally redirect to a specific page confirming email change
            // or just back to the profile/settings page.
            // For simplicity, redirecting back to `next` path defined earlier.
       }
      // For other successful OTP types (signup, magiclink, invite), redirect to 'next'
      redirectTo.pathname = next // Use the original 'next' or default '/private'
      redirect(303, redirectTo)
    }
    console.error('Email verification error:', error?.message)
     // Fall through to error redirect
  }

  // Redirect to an error page if code/token is invalid or missing
  redirectTo.pathname = '/auth/error'
  redirect(303, redirectTo)
} 