import { json, error as svelteKitError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTeamMemberRole } from '@/server/db/teams';

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
    const { supabase, user } = locals;

    if (!user) {
        throw svelteKitError(401, 'Unauthorized');
    }

    let teamId: string;
    try {
        const body = await request.json();
        teamId = body.teamId;
        if (!teamId || typeof teamId !== 'string') {
            throw new Error('Invalid teamId provided');
        }
    } catch (err) {
        console.error('Error parsing request body for setActiveTeam:', err);
        throw svelteKitError(400, 'Invalid request body. Expecting { teamId: string }.');
    }

    // Verify the user is a member of the team they are trying to set as active
    const roleResult = await getTeamMemberRole(supabase, teamId, user.id);

    if (!roleResult || !roleResult.success || !roleResult.data) {
        console.error(`User ${user.id} attempted to set active team to ${teamId} but is not a member, team doesn't exist, or DB error. Role result:`, roleResult);
        throw svelteKitError(403, 'Forbidden: You are not a member of this team, the team does not exist, or an error occurred.');
    }

    // Set the active_team_id cookie
    cookies.set('active_team_id', teamId, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return json({ success: true, message: `Active team set to ${teamId}` });
};