<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state'; // Import page store
	import { Toaster } from '$lib/components/ui/sonner/index.js';

	import AppSidebar from '$lib/components/sidebar/app-sidebar.svelte';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	// Icons for pages navigation
	import House from "@lucide/svelte/icons/house";
	import TableProperties from "@lucide/svelte/icons/table-properties";
	import Building2 from "@lucide/svelte/icons/building-2";
	import Layers2 from "@lucide/svelte/icons/layers-2";
	import Users from "@lucide/svelte/icons/users";

	let { data, children } = $props();
	let { supabase, session, user } = $derived(data);

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

	const pagesNavigation = [
		{
			name: "Home",
			url: "/app",
			icon: House,
		},
		{
			name: "All Items",
			url: "/app/items",
			icon: TableProperties,
		},
		{
			name: "All Entities",
			url: "/app/entities",
			icon: Building2,
		},
		{
			name: "My Teams/Workspaces",
			url: "/app/teams",
			icon: Layers2,
		},
		{
			name: "Invitations",
			url: "/app/invitations",
			icon: Users,
		},
	];

	let breadcrumbs = $derived((() => {
		const basePath = '/app';
		const currentPath = page.url.pathname;
		const pathSegments = currentPath.startsWith(basePath + '/') 
			? currentPath.substring(basePath.length + 1).split('/').filter(p => p)
			: [];

		if (currentPath === basePath && pathSegments.length === 0) {
			const homePage = pagesNavigation.find(p => p.url === basePath);
			return homePage ? [{ label: homePage.name, href: homePage.url }] : [];
		}

		// Check if the current page is an item detail page and data is loaded
		const isItemDetailPage = pathSegments.length === 2 && pathSegments[0] === 'items' && page.data.item;

		return pathSegments.map((segment, index, arr) => {
			const path = `${basePath}/${arr.slice(0, index + 1).join('/')}`;
			let label = segment.charAt(0).toUpperCase() + segment.slice(1);

			// If it's the last segment of an item detail page, use the item's name
			if (isItemDetailPage && index === arr.length - 1 && page.data.item.name) {
				label = page.data.item.name;
			}

			return { label, href: path };
		});
	})());
</script>

<Sidebar.Provider>
	<AppSidebar 
		collapsible="icon" 
		{user} 
		{handleLogout} 
		pages={pagesNavigation} 
		teams={data.teams} 
		activeTeam={data.activeTeam} 
	/>
	<Sidebar.Inset>
		<header
			class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12"
		>
			<div class="flex items-center gap-2 px-4">
				<Sidebar.Trigger class="-ml-1" />
				<Separator orientation="vertical" class="mr-2 h-4" />
				<Breadcrumb.Root>
					<Breadcrumb.List>
						{#each breadcrumbs as crumb, i (crumb.href)}
							<Breadcrumb.Item class={i < breadcrumbs.length -1 ? 'hidden md:flex' : ''}>
								{#if i < breadcrumbs.length - 1}
									<Breadcrumb.Link href={crumb.href}>{crumb.label}</Breadcrumb.Link>
									<Breadcrumb.Separator class="hidden md:flex" />
								{:else}
									<Breadcrumb.Page>{crumb.label}</Breadcrumb.Page>
								{/if}
							</Breadcrumb.Item>
						{/each}
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<main class="flex flex-1 flex-col gap-4 p-6 pt-0 w-full max-w-[1900px] mx-auto">
			<Toaster position="top-center" />
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>
