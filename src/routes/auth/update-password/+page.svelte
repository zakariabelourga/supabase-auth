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
                goto('/private', { invalidateAll: true }); 
            }, 2000); // Wait 2 seconds to show message
        }
    }
</script>

<svelte:head>
    <title>Update Password</title>
</svelte:head>

<div class="update-password-container">
    <h1>Set Your New Password</h1>

    {#if message}
        <p class="message success">{message}</p>
    {/if}
    {#if error}
        <p class="message error">{error}</p>
    {/if}

    <form onsubmit={handlePasswordUpdate}>
        <label>
            New Password:
            <input type="password" bind:value={password} required minlength="6" />
        </label>
        <label>
            Confirm New Password:
            <input type="password" bind:value={confirmPassword} required minlength="6" />
        </label>
        <button type="submit" disabled={loading}>
            {#if loading}Updating...{:else}Update Password{/if}
        </button>
    </form>
</div>

<style>
    .update-password-container {
        max-width: 400px;
        margin: 2rem auto;
        padding: 2rem;
        border: 1px solid #ccc;
        border-radius: 8px;
    }
    form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
    }
    label {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }
    input {
        width: 100%;
        padding: 0.5rem;
        margin-top: 0.25rem;
        box-sizing: border-box;
    }
    button {
        padding: 0.75rem;
        cursor: pointer;
        background-color: #333;
        color: white;
        border: none;
        border-radius: 4px;
    }
    button:disabled {
        background-color: #999;
        cursor: not-allowed;
    }
    .message {
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
    }
    .message.success {
        background-color: #e6fffa;
        color: #2c7a7b;
        border: 1px solid #b2f5ea;
    }
    .message.error {
        background-color: #ffebeb;
        color: #c53030;
        border: 1px solid #fed7d7;
    }
</style> 