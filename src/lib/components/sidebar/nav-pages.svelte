<script lang="ts">
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { page } from "$app/state";

	let {
		pages, // Renamed from projects
	}: {
		pages: { // Renamed from projects
			name: string;
			url: string;
			// This should be `Component` and not any after @lucide/svelte updates types
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			icon: any;
		}[];
	} = $props();
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Pages</Sidebar.GroupLabel>
	<Sidebar.Menu>
		{#each pages as item (item.name)} 
			<Sidebar.MenuItem>
				<Sidebar.MenuButton isActive={page.url.pathname === item.url}>
					{#snippet child({ props })}
						<a href={item.url} {...props}>
							<item.icon />
							<span>{item.name}</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		{/each}
	</Sidebar.Menu>
</Sidebar.Group> 