<script lang="ts">
    let { data } = $props();
    // Get user and session from the data passed down through layouts
    let { user, session } = $derived(data);
</script>

<svelte:head>
    <title>My Account</title>
</svelte:head>

<div class="container mx-auto p-4 md:p-8">
    <h1 class="text-3xl font-bold mb-6">My Account</h1>
    {#if user}
        <p class="mb-2">Welcome back, <span class="font-medium">{user.email}</span>!</p>
        <p class="mb-2">User ID: <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{user.id}</span></p>
        <p class="mb-6">Session expires at: <span class="font-medium">{session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'Unknown'}</span></p>
        
        <h2 class="text-xl font-semibold mb-3">User Metadata:</h2>
        <pre class="bg-gray-100 p-4 rounded-md overflow-x-auto text-sm font-mono">{JSON.stringify(user.user_metadata, null, 2)}</pre>
        <!-- Add profile update form here if needed -->
        
    {:else}
        <p class="text-gray-500">Loading user information...</p>
        <!-- This should ideally not be shown if auth guard works correctly -->
    {/if}
</div>