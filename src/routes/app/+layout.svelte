<script lang="ts">
    import { goto } from '$app/navigation';

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

<div class="private-layout">
    <header>
        <nav>
            <a href="/">Home</a>
            {#if session}
                <span>Logged in as: {session.user.email}</span>
                <a href="/app/account">Account</a> <!-- Link to an example account page -->
                <button onclick={handleLogout}>Logout</button>
            {/if}
        </nav>
    </header>
    <main>
        {@render children()}
    </main>
</div>

<style>
    .private-layout header {
        background-color: #f0f0f0;
        padding: 1rem;
        border-bottom: 1px solid #ddd;
    }
    nav {
        display: flex;
        gap: 1rem;
        align-items: center;
    }
    nav a,
    nav button {
        text-decoration: none;
        color: #333;
        cursor: pointer;
    }
    nav button {
        padding: 0.5rem 1rem;
        border: 1px solid #ccc;
        background-color: white;
        border-radius: 4px;
        margin-left: auto; /* Push logout button to the right */
    }
    main {
        padding: 1rem;
    }
</style> 