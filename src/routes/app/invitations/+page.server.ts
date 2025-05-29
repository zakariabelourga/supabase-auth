import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { TeamRole, TeamInvitation } from '$lib/types'; // Assuming TeamInvitation includes team name and role

export const load: PageServerLoad = async ({ locals: { supabase, session } }) => {
	if (!session?.user) {
		redirect(303, '/auth/signin');
	}
	if (!session.user.email) {
		console.error('User session found, but email is missing.');
		return fail(403, { message: 'Your account email is missing. Cannot fetch invitations.' });
	}

	const { data: invitations, error } = await supabase
		.from('team_invitations')
		.select(`
			id,
			role,
			created_at,
			teams (id, name)
		`)
		.eq('email_invited', session.user.email)
		.eq('status', 'pending');

	if (error) {
		console.error('Error fetching invitations:', error);
		return fail(500, { message: 'Failed to load invitations. Please try again.' });
	}

	// Transform data to a more usable format if necessary, e.g., flattening team details
	const pendingInvitations = invitations?.map(inv => ({
		id: inv.id,
		role: inv.role as TeamRole,
		createdAt: inv.created_at,
		teamId: inv.teams?.id,
		teamName: inv.teams?.name
	})) || [];

	return { pendingInvitations };
};

export const actions: Actions = {
	acceptInvitation: async ({ request, locals: { supabase, session } }) => {
		if (!session?.user) {
			return fail(401, { error: 'Unauthorized' });
		}
		if (!session.user.email) {
			return fail(403, { error: 'Your account email is missing. Cannot process invitation.' });
		}

		const formData = await request.formData();
		const invitationId = formData.get('invitationId') as string;

		if (!invitationId) {
			return fail(400, { error: 'Invitation ID is required.' });
		}

		// 1. Fetch the specific invitation to verify it's still pending and for the correct user
		const { data: invitation, error: fetchError } = await supabase
			.from('team_invitations')
			.select('id, team_id, role, status, email_invited')
			.eq('id', invitationId)
			.eq('email_invited', session.user.email) // Ensure it's for the logged-in user's email
			.single();

		if (fetchError || !invitation) {
			console.error('Error fetching invitation for acceptance or invitation not found:', fetchError);
			return fail(404, { error: 'Invitation not found or already processed.' });
		}

		if (invitation.status !== 'pending') {
			return fail(400, { error: `This invitation has already been ${invitation.status}.` });
		}

		// 2. Add user to team_members
		const { error: memberInsertError } = await supabase
			.from('team_members')
			.insert({
				team_id: invitation.team_id,
				user_id: session.user.id,
				role: invitation.role as TeamRole
			});

		if (memberInsertError) {
			console.error('Error adding user to team_members:', memberInsertError);
			// Handle potential conflict if user somehow got added to team_members already
			if (memberInsertError.code === '23505') { // unique_violation
				// User is already a member, proceed to update invitation status
			} else {
				return fail(500, { error: 'Failed to join the team. Please try again.' });
			}
		}

		// 3. Update invitation status to 'accepted'
		const { error: updateInviteError } = await supabase
			.from('team_invitations')
			.update({ status: 'accepted', accepted_at: new Date().toISOString() }) // Assuming 'accepted_at' column exists
			.eq('id', invitationId);

		if (updateInviteError) {
			console.error('Error updating invitation status to accepted:', updateInviteError);
			// This is tricky. User might be in team_members but invitation status failed to update.
			// For now, we'll report an error but the user might be in the team.
			return fail(500, { error: 'Joined the team, but failed to update invitation status.' });
		}

		return { success: true, message: 'Invitation accepted successfully!' };
	},

	declineInvitation: async ({ request, locals: { supabase, session } }) => {
		if (!session?.user) {
			return fail(401, { error: 'Unauthorized' });
		}
		if (!session.user.email) {
			return fail(403, { error: 'Your account email is missing. Cannot process invitation.' });
		}

		const formData = await request.formData();
		const invitationId = formData.get('invitationId') as string;

		if (!invitationId) {
			return fail(400, { error: 'Invitation ID is required.' });
		}

		// 1. Fetch the specific invitation to verify it's still pending and for the correct user
		const { data: invitation, error: fetchError } = await supabase
			.from('team_invitations')
			.select('id, status, email_invited')
			.eq('id', invitationId)
			.eq('email_invited', session.user.email)
			.single();

		if (fetchError || !invitation) {
			console.error('Error fetching invitation for declining or invitation not found:', fetchError);
			return fail(404, { error: 'Invitation not found or already processed.' });
		}

		if (invitation.status !== 'pending') {
			return fail(400, { error: `This invitation has already been ${invitation.status}.` });
		}
		
		// 2. Update invitation status to 'declined'
		const { error: updateInviteError } = await supabase
			.from('team_invitations')
			.update({ status: 'declined' })
			.eq('id', invitationId);

		if (updateInviteError) {
			console.error('Error updating invitation status to declined:', updateInviteError);
			return fail(500, { error: 'Failed to decline invitation. Please try again.' });
		}

		return { success: true, message: 'Invitation declined.' };
	}
};
