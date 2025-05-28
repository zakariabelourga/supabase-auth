<script lang="ts">
    import { goto } from '$app/navigation'; 
    import { onMount } from 'svelte'; 
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import { useSidebar } from "$lib/components/ui/sidebar/index.js";
    import { Users, ChevronsUpDown, Plus } from '@lucide/svelte/icons'; 
    import type { Team, ActiveTeam } from '$lib/types'; 

    let { teams, activeTeam }: { teams: Team[] | null | undefined; activeTeam: ActiveTeam | null | undefined } = $props();
    const sidebar = useSidebar();

    onMount(() => {
        console.log('[TeamSwitcher] onMount: teams prop:', JSON.stringify(teams, null, 2));
        console.log('[TeamSwitcher] onMount: activeTeam prop:', JSON.stringify(activeTeam, null, 2));
    });

    $effect(() => {
        console.log('[TeamSwitcher] $effect: teams prop updated:', JSON.stringify(teams, null, 2));
        console.log('[TeamSwitcher] $effect: activeTeam prop updated:', JSON.stringify(activeTeam, null, 2));
    });

    async function selectTeam(teamId: string) {
        if (activeTeam?.id === teamId) return; 

        try {
            const response = await fetch('/app/api/team', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ team_id: teamId })
            });

            if (response.ok) {
                await goto(window.location.pathname, { invalidateAll: true });
            } else {
                const errorData = await response.json();
                console.error('Failed to switch team:', errorData.message || response.statusText);
                // Optionally, show an error to the user
            }
        } catch (error) {
            console.error('Error switching team:', error);
            // Optionally, show an error to the user
        }
    }

    function navigateToCreateTeam() {
        goto('/app/teams/create');
    }
</script>

{#if activeTeam && teams}
<Sidebar.Menu>
    <Sidebar.MenuItem>
        <DropdownMenu.Root>
            <DropdownMenu.Trigger>
                {#snippet child({ props })}
                    <Sidebar.MenuButton
                        {...props}
                        size="lg"
                        class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                        <div
                            class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
                        >
                            <Users class="size-4" /> 
                        </div>
                        <div class="grid flex-1 text-left text-sm leading-tight">
                            <span class="truncate font-semibold">
                                {activeTeam.name}
                            </span>
                            {#if activeTeam.role}
                            <span class="text-muted-foreground truncate text-xs">
                                Role: {activeTeam.role.charAt(0).toUpperCase() + activeTeam.role.slice(1)}
                            </span>
                            {/if}
                        </div>
                        <ChevronsUpDown class="ml-auto size-4 shrink-0 opacity-50" />
                    </Sidebar.MenuButton>
                {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content class="w-64 p-2">
                {#each teams as team (team.id)}
                    <DropdownMenu.Item onSelect={() => selectTeam(team.id)} class={activeTeam.id === team.id ? 'bg-accent' : ''}>
                        <div class="flex items-center gap-3">
                            <div
                                class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-7 items-center justify-center rounded-md"
                            >
                                <Users class="size-3.5" /> 
                            </div>
                            <div class="grid flex-1 text-left text-sm leading-tight">
                                <span class="truncate font-medium">{team.name}</span>
                            </div>
                        </div>
                    </DropdownMenu.Item>
                {/each}
                <DropdownMenu.Separator />
                <DropdownMenu.Item onSelect={navigateToCreateTeam}>
                    <Plus class="mr-2 size-4" />
                    Create Team
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    </Sidebar.MenuItem>
</Sidebar.Menu>
{:else if teams && teams.length === 0}
    <Sidebar.Menu>
        <Sidebar.MenuItem class="font-semibold p-0">
            <button onclick={navigateToCreateTeam} class="flex items-center w-full h-full px-2 py-1.5 text-left">
                <Plus class="mr-2 size-4" />
                Create Your First Team
            </button>
        </Sidebar.MenuItem>
    </Sidebar.Menu>
{:else}
    <!-- Optional: Loading state or placeholder if teams/activeTeam are null/undefined initially -->
    <Sidebar.Menu>
        <Sidebar.MenuItem class="font-semibold p-0">
            <div class="flex items-center w-full h-full px-2 py-1.5 text-left">
                Loading teams...
            </div>
        </Sidebar.MenuItem>
    </Sidebar.Menu>
{/if}
