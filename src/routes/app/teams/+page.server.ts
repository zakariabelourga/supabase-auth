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

        console.log(session.user.id)

        // 1. Create the new team
        const { data: newTeam, error: teamError } = await supabase
            .from('teams')
            .insert({
                name: teamName.trim(),
                owner_user_id: session.user.id
            })
            .select()
            .single(); // To get the created team record back, including its ID

        if (teamError || !newTeam) {
            console.error('Error creating team:', teamError);
            // Consider more specific error messages based on teamError.code (e.g., unique constraint violation for name)
            if (teamError?.code === '23505') { // Unique violation for name (if you add a unique constraint)
                 return fail(409, { teamName, error: 'A team with this name already exists.' });
            }
            return fail(500, { teamName, error: 'Failed to create the team. Please try again.' });
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
            return fail(500, { teamName, error: 'Team created, but failed to set you as admin. Team creation rolled back.' });
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

        const { error } = await supabase
            .from('teams')
            .update({ name: newName.trim() })
            .eq('id', teamId);

        if (error) {
            console.error('Error renaming team:', error);
            if (error.code === '42501') { // RLS violation
                return fail(403, { newName, error: 'You do not have permission to rename this team.' });
            }
            return fail(500, { newName, error: 'Failed to rename the team. Please try again.' });
        }

        return { success: true, message: 'Team renamed successfully.', teamId, newName: newName.trim() };
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
        const role = formData.get('role') as TeamMember['role']; // 'admin', 'editor', or 'viewer'

        if (!teamId || !userEmail || !role) {
            return fail(400, { userEmail, role, error: 'Team ID, user email, and role are required.' });
        }

        if (!['editor', 'viewer', 'admin'].includes(role)) {
            return fail(400, { userEmail, role, error: "Invalid role. Must be 'editor', 'viewer', or 'admin'." });
        }

        // 1. Get the user ID from the email using the RPC function
        const { data: invitedUserData, error: rpcError } = await supabase
            .rpc('get_user_id_by_email', { email_text: userEmail.toLowerCase().trim() });

        if (rpcError || !invitedUserData) {
            console.error('Error fetching user by email or user not found:', rpcError);
            return fail(404, { userEmail, role, error: 'User with this email not found.' });
        }

        const invitedUserId = invitedUserData as string; // RPC returns the UUID directly

        if (invitedUserId === session.user.id) {
            return fail(400, { userEmail, role, error: 'You cannot invite yourself to the team.'});
        }

        // 2. Check if the user is already a member of the team
        const { data: existingMember, error: checkMemberError } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('team_id', teamId)
            .eq('user_id', invitedUserId)
            .maybeSingle(); 

        if (checkMemberError) {
            console.error('Error checking existing member:', checkMemberError);
            return fail(500, { userEmail, role, error: 'Could not verify team membership. Please try again.' });
        }

        if (existingMember) {
            return fail(409, { userEmail, role, error: 'This user is already a member of the team.' });
        }

        // 3. Add the user to the team_members table
        const { error: insertMemberError } = await supabase
            .from('team_members')
            .insert({
                team_id: teamId,
                user_id: invitedUserId,
                role: role
            });

        if (insertMemberError) {
            console.error('Error adding member to team:', insertMemberError);
            if (insertMemberError.code === '42501') { // RLS violation on team_members insert
                return fail(403, { userEmail, role, error: 'You do not have permission to add members to this team.' });
            }
            return fail(500, { userEmail, role, error: 'Failed to add user to the team. Please try again.' });
        }

        return { success: true, message: `User ${userEmail} invited to the team as ${role}.`, teamId };
    }
}; 