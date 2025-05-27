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

        // Optionally, redirect to the new team's page or settings page
        // redirect(303, `/app/teams/${newTeam.id}/settings`);
        return { success: true, teamId: newTeam.id, teamName: newTeam.name }; // Or return data for the current page to update
    },
}; 