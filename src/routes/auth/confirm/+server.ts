import { redirect } from '@sveltejs/kit'
import { type EmailOtpType } from '@supabase/supabase-js'

export const GET = async (event) => {
  const {
    url,
    locals: { supabase },
  } = event

  console.log(`[/auth/confirm] Received URL: ${url.toString()}`)

  const token_hash = url.searchParams.get('token_hash') as string
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = url.searchParams.get('next') ?? '/'

  console.log(`[/auth/confirm] Parsed params: token_hash=${token_hash ? 'present' : 'missing'}, type=${type}, next=${next}`)

  /**
   * Clean up the redirect URL by deleting the Auth flow parameters.
   *
   * `next` is preserved for now, because it's needed in the error case.
   */
  const redirectTo = new URL(url)
  redirectTo.pathname = next
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('type')

  if (token_hash && type) {
    console.log(`[/auth/confirm] Attempting verifyOtp with type: ${type}`)
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      console.log(`[/auth/confirm] verifyOtp successful. Preparing redirect to: ${redirectTo.pathname}`)
      redirectTo.searchParams.delete('next')
      console.log(`[/auth/confirm] Final redirect URL: ${redirectTo.toString()}`)
      redirect(303, redirectTo)
    } else {
      console.error(`[/auth/confirm] verifyOtp error: ${error.message}`)
    }
  }

  // return the user to an error page with some instructions
  console.warn('[/auth/confirm] No valid token/type or verifyOtp failed. Redirecting to error page.')
  redirectTo.pathname = '/auth/error'
  // Ensure 'next' is also deleted for the error redirect if it was present
  redirectTo.searchParams.delete('next') 
  redirect(303, redirectTo)
} 