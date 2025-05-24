<script lang="ts" module>
	import AudioWaveform from "@lucide/svelte/icons/audio-waveform";
	import Command from "@lucide/svelte/icons/command";
	import GalleryVerticalEnd from "@lucide/svelte/icons/gallery-vertical-end";

	// This is sample data.
	const data = {
		teams: [
			{
				name: "Acme Inc",
				logo: GalleryVerticalEnd,
				plan: "Enterprise",
			},
			{
				name: "Acme Corp.",
				logo: AudioWaveform,
				plan: "Startup",
			},
			{
				name: "Evil Corp.",
				logo: Command,
				plan: "Free",
			},
		]
		// pages data is passed as a prop
	};
</script>

<script lang="ts">
	import NavPages from "$lib/components/sidebar/nav-pages.svelte";
	import NavUser from "$lib/components/sidebar/nav-user.svelte";
	import TeamSwitcher from "$lib/components/sidebar/team-switcher.svelte";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import type { ComponentProps, SvelteComponent } from "svelte"; // Added SvelteComponent for icon type
	import type { User } from '@supabase/supabase-js';

	// Define a more specific type for page items, including the icon
	interface PageItem {
		name: string;
		url: string;
		icon: any; // Changed from typeof SvelteComponent to any for broader compatibility
	}

	let {
		ref = $bindable(null),
		collapsible = "icon",
		user,
		handleLogout,
		pages, // Add pages prop
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		user: User | null;
		handleLogout: () => Promise<void>;
		pages: PageItem[]; // Use the PageItem interface for the pages prop
	} = $props();
</script>

<Sidebar.Root bind:ref {collapsible} {...restProps}>
	<Sidebar.Header>
		<TeamSwitcher teams={data.teams} />
	</Sidebar.Header>
	<Sidebar.Content>
		<!-- Pass pages prop to NavPages -->
		<NavPages {pages} />
	</Sidebar.Content>
	<Sidebar.Footer>
		{#if user}
			<NavUser user={{
				name: user.user_metadata?.full_name || user.email || 'User',
				email: user.email || '',
				avatar: user.user_metadata?.avatar_url
			}} {handleLogout} />
		{/if}
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
