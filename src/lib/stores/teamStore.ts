import { page } from '$app/state';
import { writable, type Readable } from 'svelte/store';
import type { ActiveTeam } from '$lib/types';

/**
 * A Svelte store that provides reactive access to the active team.
 * It mirrors the `activeTeam` object from the SvelteKit page state.
 *
 * @example
 * <script lang="ts">
 *   import { activeTeamStore } from '$lib/stores/teamStore';
 *
 *   let currentTeam = $derived(activeTeamStore); // Svelte 5 style with runes
 *
 *   if (currentTeam) {
 *     console.log('Current active team:', currentTeam.name);
 *   }
 * </script>
 *
 * {#if $activeTeamStore}
 *   <p>Active Team: {$activeTeamStore.name}</p>
 * {/if}
 */

// Create a writable store internally
const activeTeamWritable = writable<ActiveTeam | null | undefined>(undefined, (set) => {
    // Effect to sync the writable store with the reactive page state
    // Use $effect.root to tie the effect's lifecycle to the store's first subscriber / last unsubscriber
    const unsubscribeRootEffect = $effect.root(() => {
        $effect(() => {
            // Ensure we handle the case where page.data might not be immediately available
            // or activeTeam is not yet populated.
            const currentActiveTeam = page.data?.activeTeam as ActiveTeam | null | undefined;
            set(currentActiveTeam);
            // console.log('[teamStore] $effect: activeTeam updated to', currentActiveTeam?.name);
        });
    });

    return () => {
        unsubscribeRootEffect(); // Cleanup the root effect when the store has no more subscribers
        // console.log('[teamStore] No more subscribers, cleaning up effect.');
    };
});

// Expose only the readable part of the store
export const activeTeamStore: Readable<ActiveTeam | null | undefined> = {
    subscribe: activeTeamWritable.subscribe
};

// You can also provide an initial value if needed, for instance, if activeTeam might not be on $page.data immediately:
// export const activeTeamStore = derived(
//     page,
//     (currentPage) => currentPage.data.activeTeam as ActiveTeam | null | undefined,
//     undefined // Initial value
// ); 