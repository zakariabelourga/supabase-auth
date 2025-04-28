<script lang="ts">
	import '../app.css';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data, children } = $props();
	// Make session and supabase available
	let { session, supabase } = $derived(data);

	onMount(() => {
		const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
			// Check if the session has changed (e.g., sign in, sign out, token refresh)
			if (newSession?.expires_at !== session?.expires_at) {
				// Invalidate the 'supabase:auth' dependency to trigger a reload
				invalidate('supabase:auth');
			}
		});

		// Cleanup the listener when the component unmounts
		return () => {
			listener?.subscription.unsubscribe();
		};
	});
</script>

{@render children()}
