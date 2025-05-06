<script lang="ts">
    import { goto } from '$app/navigation';
    import { enhance } from '$app/forms'; // Optional: for progressive enhancement if using server actions
    import type { PageData } from './$types';

    // Get Supabase client from layout data
    let { data }: { data: PageData } = $props();
    let { supabase } = $derived(data);

    let password = $state('');
    let confirmPassword = $state('');
    let message = $state<string | null>(null);
    let error = $state<string | null>(null);
    let loading = $state(false);

    async function handlePasswordUpdate(event: Event) {
        event.preventDefault(); // Prevent default form submission
        if (!supabase) {
            error = 'Supabase client not available.';
            return;
        }
        if (password !== confirmPassword) {
            error = 'Passwords do not match.';
            return;
        }
        if (password.length < 6) { // Basic validation, match Supabase default
            error = 'Password must be at least 6 characters long.';
            return;
        }

        loading = true;
        error = null;
        message = null;

        const { error: updateError } = await supabase.auth.updateUser({
            password: password,
        });

        loading = false;

        if (updateError) {
            console.error('Password update error:', updateError.message);
            error = `Failed to update password: ${updateError.message}`;
        } else {
            message = 'Password updated successfully! Redirecting...';
            // Clear sensitive fields
            password = '';
            confirmPassword = '';
            // Redirect to a private page after successful update
            setTimeout(() => {
                goto('/app', { invalidateAll: true }); 
            }, 2000); // Wait 2 seconds to show message
        }
    }
</script>

<svelte:head>
    <title>Update Password</title>
</svelte:head>

<div class="max-w-md mx-auto my-8 p-8 border border-gray-200 rounded-lg shadow-sm">
    <h1 class="text-2xl font-bold mb-4">Set Your New Password</h1>

    {#if message}
        <p class="p-3 mb-4 rounded-md bg-green-50 text-green-700 border border-green-200">{message}</p>
    {/if}
    {#if error}
        <p class="p-3 mb-4 rounded-md bg-red-50 text-red-700 border border-red-200">{error}</p>
    {/if}

    <form onsubmit={handlePasswordUpdate} class="flex flex-col gap-4 mt-4">
        <label class="flex flex-col">
            <span class="mb-1">New Password:</span>
            <input type="password" bind:value={password} required minlength="6" class="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <label class="flex flex-col">
            <span class="mb-1">Confirm New Password:</span>
            <input type="password" bind:value={confirmPassword} required minlength="6" class="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <button type="submit" disabled={loading} class="py-3 px-4 bg-gray-800 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 disabled:opacity-50 disabled:bg-gray-500 disabled:cursor-not-allowed mt-2">
            {#if loading}Updating...{:else}Update Password{/if}
        </button>
    </form>
</div>