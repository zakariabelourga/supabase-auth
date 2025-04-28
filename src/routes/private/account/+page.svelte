<script lang="ts">
    let { data } = $props();
    // Get user and session from the data passed down through layouts
    let { user, session } = $derived(data);
</script>

<svelte:head>
    <title>My Account</title>
</svelte:head>

<div class="account-page">
    <h1>My Account</h1>
    {#if user}
        <p>Welcome back, {user.email}!</p>
        <p>User ID: {user.id}</p>
        <p>Session expires at: {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'Unknown'}</p>
        
        <h2>User Metadata:</h2>
        <pre>{JSON.stringify(user.user_metadata, null, 2)}</pre>
        <!-- Add profile update form here if needed -->
        
    {:else}
        <p>Loading user information...</p>
        <!-- This should ideally not be shown if auth guard works correctly -->
    {/if}
</div>

<style>
    .account-page {
        padding: 1rem;
    }
    pre {
        background-color: #f5f5f5;
        padding: 1rem;
        border-radius: 4px;
        overflow-x: auto;
    }
</style> 