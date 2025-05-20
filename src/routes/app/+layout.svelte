<script lang="ts">
    import { goto } from '$app/navigation';
    import { Toaster } from "$lib/components/ui/sonner/index.js";

    let { data, children } = $props();
    let { supabase, session } = $derived(data);

    const handleLogout = async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error logging out:', error.message);
            // Optionally show an error message to the user
        } else {
            // Invalidate layout and redirect to home or auth page
            // invalidate('supabase:auth'); // Invalidation happens automatically via listener in root layout
            goto('/auth', { invalidateAll: true }); // Redirect after sign out
        }
    };
</script>

<div class="min-h-screen flex flex-col">
    <header class="bg-gray-100 py-4 px-4 border-b border-gray-200">
        <nav class="flex gap-4 items-center">
            <a href="/" class="text-blue-600 hover:text-blue-800">Home</a>
            {#if session}
                <span class="text-gray-600">Logged in as: {session.user.email}</span>
                <a href="/app/account" class="text-blue-600 hover:text-blue-800">Account</a> <!-- Link to an example account page -->
                <button onclick={handleLogout} class="text-blue-600 hover:text-blue-800">Logout</button>
            {/if}
        </nav>
    </header>
    <main class="flex-grow p-4">
        <Toaster position="top-right" />
        {@render children()}
    </main>
</div>