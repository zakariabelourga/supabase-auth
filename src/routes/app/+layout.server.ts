import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    console.log('[+layout.server.ts] load: Starting');
    // locals.teams and locals.activeTeam are populated by the activeTeamHook in hooks.server.ts
    const { teams, activeTeam } = locals;
    console.log('[+layout.server.ts] load: locals.teams received:', JSON.stringify(teams, null, 2));
    console.log('[+layout.server.ts] load: locals.activeTeam received:', JSON.stringify(activeTeam, null, 2));

    console.log('[+layout.server.ts] load: Returning teams and activeTeam.');
    return {
        teams,
        activeTeam
    };
};
