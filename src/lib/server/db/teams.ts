import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';
import type { TeamRole, Team } from '$lib/types';

interface RoleQueryResult {
    success: boolean;
    data?: TeamRole | null;
    error?: string;
}

/**
 * Fetches the role of a specific user within a specific team.
 * @param supabase The Supabase client instance.
 * @param teamId The ID of the team.
 * @param userId The ID of the user.
 * @returns An object containing the success status, the user's role, or an error message.
 */
export async function getTeamMemberRole(
    supabase: SupabaseClient<Database>,
    teamId: string,
    userId: string
): Promise<RoleQueryResult> {
    if (!teamId || !userId) {
        return { success: false, error: 'Team ID and User ID must be provided.' };
    }

    try {
        const { data, error } = await supabase
            .from('team_members')
            .select('role')
            .eq('team_id', teamId)
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // PGRST116 indicates that no rows were found
                console.warn(`No team membership found for user ${userId} in team ${teamId}.`);
                return { success: true, data: null }; // Not an error, user is just not a member or team doesn't exist for them
            }
            console.error('Error fetching team member role:', error);
            return { success: false, error: error.message };
        }

        if (!data) {
             console.warn(`No team membership data found for user ${userId} in team ${teamId} (data is null).`);
            return { success: true, data: null }; // Should be caught by PGRST116, but as a safeguard
        }

        return { success: true, data: data.role as TeamRole };
    } catch (err: any) {
        console.error('Unexpected error in getTeamMemberRole:', err);
        return { success: false, error: err.message || 'An unexpected error occurred.' };
    }
}

interface UserTeamQueryResult {
    success: boolean;
    data?: Team[];
    error?: string;
}

/**
 * Fetches all teams a user is a member of.
 * @param supabase The Supabase client instance.
 * @param userId The ID of the user.
 * @returns An object containing the success status, a list of teams, or an error message.
 */
export async function getAllTeamsForUser(
    supabase: SupabaseClient<Database>,
    userId: string
): Promise<UserTeamQueryResult> {
    if (!userId) {
        return { success: false, error: 'User ID must be provided.' };
    }

    try {
        const { data, error } = await supabase
            .from('team_members')
            .select(`
                teams (
                    id,
                    name,
                    owner_user_id,
                    created_at,
                    updated_at
                )
            `)
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching teams for user:', error);
            return { success: false, error: error.message };
        }

        const teams = data?.map(item => item.teams).filter(team => team !== null) as Team[] | undefined;

        return { success: true, data: teams || [] };
    } catch (err: any) {
        console.error('Unexpected error in getAllTeamsForUser:', err);
        return { success: false, error: err.message || 'An unexpected error occurred.' };
    }
}
