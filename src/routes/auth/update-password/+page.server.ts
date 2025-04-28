import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	updatePassword: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			// The user should be logged in to update their password.
			// This happens when the user follows the link from the password reset email.
			// Supabase handles the session creation via the link.
			// If no session exists, redirect to login.
			throw redirect(303, '/auth/login');
		}

		const formData = await request.formData();
		const password = formData.get('password') as string;

		if (!password) {
			return fail(400, { error: 'Password is required.', success: false });
		}

		const { error } = await supabase.auth.updateUser({
			password: password
		});

		if (error) {
			return fail(500, { error: error.message, success: false });
		}

		// Optionally redirect the user after successful password update
		// throw redirect(303, '/private');

		return { success: true, error: null };
	}
}; 