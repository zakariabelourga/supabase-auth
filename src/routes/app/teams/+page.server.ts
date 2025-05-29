import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Team, TeamMember } from '$lib/types'; // Adjust path as needed

export const load: PageServerLoad = async ({ locals: { supabase, session } }) => {
	if (!session) {
		redirect(303, '/');
	}

    // Fetch teams where the current user is a member
    const { data: teamMemberships, error: membershipsError } = await supabase
        .from('team_members')
        .select('team_id, role, teams (*)') // Fetch team details along with membership
        .eq('user_id', session.user.id);

    if (membershipsError) {
        console.error('Error fetching team memberships:', membershipsError);
        return fail(500, { message: 'Server error trying to fetch your teams. Please try again later.' });
    }

    // Extract the team data from the memberships
    const teams = teamMemberships?.map(membership => ({
        ...(membership.teams as Team), // Spread the team details
        currentUserRole: membership.role as TeamMember['role'] // Add the user's role in this specific team
    })) || [];

    return { teams };
};

export const actions: Actions = {
    createTeam: async ({ request, locals: { supabase, session } }) => {
        if (!session) {
            redirect(303, '/auth/signin');
        }

        const formData = await request.formData();
        const teamName = formData.get('teamName') as string;

        if (!teamName || teamName.trim().length < 3) {
            return fail(400, { teamName, error: 'Team name must be at least 3 characters long.' });
        }

        const trimmedTeamName = teamName.trim();

        // Check if the user already owns a team with this name
        const { data: existingUserTeam, error: existingTeamCheckError } = await supabase
            .from('teams')
            .select('id')
            .eq('name', trimmedTeamName)
            .eq('owner_user_id', session.user.id)
            .maybeSingle();

        if (existingTeamCheckError) {
            console.error('Error checking for existing team name:', existingTeamCheckError);
            return fail(500, { teamName: trimmedTeamName, error: 'Server error while checking team name. Please try again.' });
        }

        if (existingUserTeam) {
            return fail(409, { teamName: trimmedTeamName, error: `You already have a team named "${trimmedTeamName}". Please choose a different name.` });
        }

        // 1. Create the new team
        const { data: newTeam, error: teamError } = await supabase
            .from('teams')
            .insert({
                name: trimmedTeamName,
                owner_user_id: session.user.id
            })
            .select()
            .single(); // To get the created team record back, including its ID

        if (teamError || !newTeam) {
            console.error('Error creating team:', teamError);
            if (teamError?.code === '23505') { // Unique violation (e.g., global unique constraint on name)
                 return fail(409, { teamName: trimmedTeamName, error: 'A team with this name already exists globally. Please choose another.' });
            }
            return fail(500, { teamName: trimmedTeamName, error: 'Failed to create the team. Please try again.' });
        }

        // 2. Add the creator as an admin to the new team
        const { error: memberError } = await supabase
            .from('team_members')
            .insert({
                team_id: newTeam.id,
                user_id: session.user.id,
                role: 'admin'
            });

        if (memberError) {
            console.error('Error adding team creator as admin:', memberError);
            // Attempt to clean up the created team if adding the member fails
            await supabase.from('teams').delete().eq('id', newTeam.id);
            return fail(500, { teamName: trimmedTeamName, error: 'Team created, but failed to set you as admin. Team creation rolled back.' });
        }

        // Return a success response
        return {
            success: true,
            message: `Team "${newTeam.name}" created successfully!`, // Provide a success message
            teamId: newTeam.id, // Pass back the new team's ID for potential use in UI
            teamName: newTeam.name, // Pass back the new team's name
            error: null // Explicitly include error as null for type consistency
        };
    },

    renameTeam: async ({ request, locals: { supabase, session } }) => {
        if (!session) {
            return fail(401, { error: 'Unauthorized' });
        }

        const formData = await request.formData();
        const teamId = formData.get('teamId') as string;
        const newName = formData.get('newName') as string;

        if (!teamId) {
            return fail(400, { newName, error: 'Team ID is required.' });
        }
        if (!newName || newName.trim().length < 3) {
            return fail(400, { newName, error: 'New team name must be at least 3 characters long.' });
        }

        const trimmedNewName = newName.trim();

        // 1. Get the team's owner_user_id to check for name uniqueness against the owner's other teams
        const { data: teamData, error: teamOwnerError } = await supabase
            .from('teams')
            .select('owner_user_id')
            .eq('id', teamId)
            .single();

        if (teamOwnerError || !teamData) {
            console.error('Error fetching team owner for rename validation:', teamOwnerError);
            // This could also be an RLS issue if the user trying to rename isn't an admin, 
            // but the RLS on update should primarily handle that.
            // If RLS passed for the user to even attempt rename, but team not found, it's an issue.
            return fail(404, { newName: trimmedNewName, error: 'Team not found or could not verify owner for name validation.' });
        }
        const ownerId = teamData.owner_user_id;

        // 2. Check if the owner already has another team with this new name
        const { data: existingTeamWithNewName, error: existingNameError } = await supabase
            .from('teams')
            .select('id')
            .eq('name', trimmedNewName)
            .eq('owner_user_id', ownerId) // Check against the team's actual owner
            .neq('id', teamId)           // Exclude the current team being renamed
            .maybeSingle();

        if (existingNameError) {
            console.error('Error checking for existing team name during rename:', existingNameError);
            return fail(500, { newName: trimmedNewName, error: 'Server error while checking new team name. Please try again.' });
        }

        if (existingTeamWithNewName) {
            return fail(409, { newName: trimmedNewName, error: `The team owner already has another team named "${trimmedNewName}". Please choose a different name.` });
        }

        // 3. Proceed with the rename if no conflict
        const { error } = await supabase
            .from('teams')
            .update({ name: trimmedNewName })
            .eq('id', teamId);

        if (error) {
            console.error('Error renaming team:', error);
            if (error.code === '42501') { // RLS violation
                return fail(403, { newName: trimmedNewName, error: 'You do not have permission to rename this team.' });
            }
            if (error.code === '23505') { // Unique violation (e.g., global unique constraint on name)
                return fail(409, { newName: trimmedNewName, error: 'A team with this name already exists globally. Please choose another.' });
            }
            return fail(500, { newName: trimmedNewName, error: 'Failed to rename the team. Please try again.' });
        }

        return { success: true, message: 'Team renamed successfully.', teamId, newName: trimmedNewName };
    },

    deleteTeam: async ({ request, locals: { supabase, session } }) => {
        if (!session) {
            return fail(401, { error: 'Unauthorized' });
        }

        const formData = await request.formData();
        const teamId = formData.get('teamId') as string;

        if (!teamId) {
            return fail(400, { error: 'Team ID is required.' });
        }

        const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', teamId);

        if (error) {
            console.error('Error deleting team:', error);
            if (error.code === '42501') { // RLS violation
                return fail(403, { error: 'You do not have permission to delete this team.' });
            }
            return fail(500, { error: 'Failed to delete the team. Please try again.' });
        }

        return { success: true, message: 'Team deleted successfully.', teamId };
    },

    inviteUser: async ({ request, locals: { supabase, session } }) => {
        if (!session) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const teamId = formData.get('teamId') as string;
		const userEmail = formData.get('userEmail') as string;
		const role = formData.get('role') as TeamMember['role'];

		if (!teamId || !userEmail || !role) {
			return fail(400, { userEmail, role, error: 'Team ID, user email, and role are required.' });
		}

		const trimmedUserEmail = userEmail.toLowerCase().trim();

		if (!['editor', 'viewer', 'admin'].includes(role)) {
			return fail(400, { userEmail: trimmedUserEmail, role, error: "Invalid role. Must be 'editor', 'viewer', or 'admin'." });
		}

		// 1. Attempt to get existing user ID from email (it's okay if not found)
		let invitedUserId: string | null = null;
		const { data: invitedUserData, error: rpcError } = await supabase
			.rpc('get_user_id_by_email', { email_text: trimmedUserEmail });

		if (rpcError && rpcError.message !== 'PGRST116') { // PGRST116: "Searched for a single row, but found no rows"
			console.error('Error fetching user by email:', rpcError);
			return fail(500, { userEmail: trimmedUserEmail, role, error: 'Error trying to verify email. Please try again.' });
		}
		if (invitedUserData) {
			invitedUserId = invitedUserData as string; // RPC returns the UUID directly
		}

		// 2. Perform checks if the email corresponds to an existing user
		if (invitedUserId) {
			// Check for self-invite
			if (invitedUserId === session.user.id) {
				return fail(400, { userEmail: trimmedUserEmail, role, error: 'You cannot invite yourself to the team.' });
			}

			// Check if the user is already a member of the team
			const { data: existingMember, error: checkMemberError } = await supabase
				.from('team_members')
				.select('team_id')
				.eq('team_id', teamId)
				.eq('user_id', invitedUserId)
				.maybeSingle();

			if (checkMemberError) {
				console.error('Error checking existing member:', checkMemberError);
				return fail(500, { userEmail: trimmedUserEmail, role, error: 'Could not verify team membership. Please try again.' });
			}

			if (existingMember) {
				return fail(409, { userEmail: trimmedUserEmail, role, error: 'This user is already a member of the team.' });
			}
		}

		// 3. Check for an existing PENDING invitation for this email to this team
		const { data: existingInvitation, error: checkInvitationError } = await supabase
			.from('team_invitations')
			.select('id')
			.eq('team_id', teamId)
			.eq('email_invited', trimmedUserEmail)
			.eq('status', 'pending')
			.maybeSingle();

		if (checkInvitationError) {
			console.error('Error checking existing invitation:', checkInvitationError);
			return fail(500, { userEmail: trimmedUserEmail, role, error: 'Could not verify existing invitations. Please try again.' });
		}

		if (existingInvitation) {
			return fail(409, { userEmail: trimmedUserEmail, role, error: 'An invitation for this email to this team is already pending.' });
		}

		// 4. Create an invitation in the team_invitations table
		const { error: insertInviteError } = await supabase
			.from('team_invitations')
			.insert({
				team_id: teamId,
				email_invited: trimmedUserEmail,
				invited_by_user_id: session.user.id,
				role: role, // IMPORTANT: Assumes 'role' column exists/will be added to team_invitations table
				// 'status' should default to 'pending' in the database schema
			});

		if (insertInviteError) {
			console.error('Error creating team invitation:', insertInviteError);
			if (insertInviteError.message.includes('permission denied') || insertInviteError.code === '42501' || insertInviteError.code === 'P0001') {
				 return fail(403, { userEmail: trimmedUserEmail, role, error: 'You do not have permission to send invitations for this team.' });
			}
			return fail(500, { userEmail: trimmedUserEmail, role, error: 'Failed to send invitation. Please try again.' });
		}

		return { success: true, message: `Invitation sent to ${userEmail} for the role of ${role}.`, teamId };
    }
}; 