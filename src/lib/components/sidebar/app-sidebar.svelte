<script lang="ts" module>
	// This script block with mock data can be removed or commented out if not used elsewhere.
	// import AudioWaveform from "@lucide/svelte/icons/audio-waveform";
	// import Command from "@lucide/svelte/icons/command";
	// import GalleryVerticalEnd from "@lucide/svelte/icons/gallery-vertical-end";

	// const data = {
	// 	teams: [
	// 		{
	// 			name: "Acme Inc",
	// 			logo: GalleryVerticalEnd,
	// 			plan: "Enterprise",
	// 		},
	// 		{
	// 			name: "Acme Corp.",
	// 			logo: AudioWaveform,
	// 			plan: "Startup",
	// 		},
	// 		{
	// 			name: "Evil Corp.",
	// 			logo: Command,
	// 			plan: "Free",
	// 		},
	// 	]
	// 	// pages data is passed as a prop
	// };
</script>

<script lang="ts">
	import NavPages from "$lib/components/sidebar/nav-pages.svelte";
	import NavUser from "$lib/components/sidebar/nav-user.svelte";
	import TeamSwitcher from "$lib/components/sidebar/team-switcher.svelte";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import type { ComponentProps } from "svelte"; 
	import type { User } from '@supabase/supabase-js';
	import type { Team, ActiveTeam } from '$lib/types'; // Import Team and ActiveTeam types

	// Define a more specific type for page items, including the icon
	interface PageItem {
		name: string;
		url: string;
		icon: any; 
	}

	let {
		ref = $bindable(null),
		collapsible = "icon",
		user,
		handleLogout,
		pages, // Add pages prop
		teams, // Add teams prop
		activeTeam, // Add activeTeam prop
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		user: User | null;
		handleLogout: () => Promise<void>;
		pages: PageItem[]; 
		teams: Team[] | null | undefined; // Define teams prop type
		activeTeam: ActiveTeam | null | undefined; // Define activeTeam prop type
	} = $props();
</script>

<Sidebar.Root variant="inset" bind:ref {collapsible} {...restProps}>
	<Sidebar.Header>
		<TeamSwitcher {teams} {activeTeam} />
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
</Sidebar.Root>
