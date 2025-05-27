<script lang="ts">
    import type { PageData, ActionData } from './$types';
    import { enhance } from '$app/forms';
    import { invalidateAll } from '$app/navigation';

    export let data: PageData;
    export let form: ActionData; // To get feedback from the createTeam action

    // Function to handle successful form submission
    const handleCreateSuccess = () => {
        // Invalidate all data to refresh the teams list
        invalidateAll(); 
        // Optionally, reset the form fields or display a specific success message
        // You could clear form?.success or form?.teamId here if needed, or set a local variable
        const teamNameInput = document.getElementById('teamName') as HTMLInputElement;
        if(teamNameInput) teamNameInput.value = '';
    };

</script>

<svelte:head>
    <title>Your Teams</title>
</svelte:head>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-semibold mb-6">Your Teams</h1>

    {#if data.teams && data.teams.length > 0}
        <ul class="space-y-4 mb-8">
            {#each data.teams as team}
                <li class="p-4 border rounded-lg shadow hover:shadow-md transition-shadow">
                    <a href="/app/teams/{team.id}" class="text-lg font-medium text-blue-600 hover:text-blue-800">
                        {team.name}
                    </a>
                    <p class="text-sm text-gray-600">Your role: <span class="font-semibold">{team.currentUserRole}</span></p>
                    <!-- Add more team details here if needed, e.g., number of members -->
                </li>
            {/each}
        </ul>
    {:else if !data.teams}
        <p class="text-gray-700">Loading teams...</p> <!-- Or handle initial loading state more robustly -->
    {:else}
        <p class="text-gray-700 mb-8">You are not a member of any teams yet. Create one below!</p>
    {/if}

    <div class="bg-gray-50 p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold mb-4">Create New Team</h2>
        <form method="POST" action="?/createTeam" use:enhance={() => {
            return async ({ result, update }) => {
                if (result.type === 'success' && result.data?.success) {
                    handleCreateSuccess();
                }
                // For other result types (failure, redirect, etc.), SvelteKit handles them by default
                // or you can add custom logic here.
                await update(); // Essential for SvelteKit to update the form prop and page data
            };
        }} class="space-y-4">
            <div>
                <label for="teamName" class="block text-sm font-medium text-gray-700">Team Name</label>
                <input 
                    type="text" 
                    name="teamName" 
                    id="teamName"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="My Awesome Team"
                    minlength="3"
                    required
                    aria-describedby="teamName-error"
                    value={form?.teamName || ''}
                />
                {#if form?.error}
                    <p id="teamName-error" class="mt-2 text-sm text-red-600">{form.error}</p>
                {/if}
                 {#if form?.success}
                    <p class="mt-2 text-sm text-green-600">Team "{form.teamName}" created successfully!</p>
                {/if}
            </div>
            <div>
                <button 
                    type="submit" 
                    class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    Create Team
                </button>
            </div>
        </form>
    </div>
</div>

<style>
    /* Basic container styling, Tailwind handles most of it */
    /* You can add more specific styles here if needed */
</style> 