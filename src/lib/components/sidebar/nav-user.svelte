<script lang="ts">
	import * as Avatar from "$lib/components/ui/avatar/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { useSidebar } from "$lib/components/ui/sidebar/index.js";
	import { goto } from '$app/navigation';
	import Bell from "@lucide/svelte/icons/bell";
	import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
	import CreditCard from "@lucide/svelte/icons/credit-card";
	import LogOut from "@lucide/svelte/icons/log-out";
	import Sparkles from "@lucide/svelte/icons/sparkles";
	import User from "@lucide/svelte/icons/user";

	let {
		user,
		handleLogout,
	}: {
		user: { name: string; email: string; avatar: string } | null;
		handleLogout: () => Promise<void>;
	} = $props();
	const sidebar = useSidebar();
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton
						size="lg"
						class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						{...props}
					>
						{#if user}
							<Avatar.Root class="">
								<Avatar.Image src={user.avatar} alt={user.name} />
								<Avatar.Fallback class="rounded-lg">
									{user.name?.substring(0, 2).toUpperCase() || "???"}
								</Avatar.Fallback>
							</Avatar.Root>
							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-semibold">{user.name}</span>
								<span class="truncate text-xs">{user.email}</span>
							</div>
						{:else}
							<Avatar.Root class="">
								<Avatar.Fallback class="rounded-lg">??</Avatar.Fallback>
							</Avatar.Root>
							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-semibold">Not Logged In</span>
								<span class="truncate text-xs"></span>
							</div>
						{/if}
						<ChevronsUpDown class="ml-auto size-4" />
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="w-[var(--bits-dropdown-menu-anchor-width)] min-w-56 rounded-lg"
				side={sidebar.isMobile ? "bottom" : "right"}
				align="end"
				sideOffset={4}
			>
				{#if user}
					<DropdownMenu.Label class="p-0 font-normal">
						<div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
							<Avatar.Root class="">
								<Avatar.Image src={user.avatar} alt={user.name} />
								<Avatar.Fallback class="rounded-lg">
									{user.name?.substring(0, 2).toUpperCase() || "???"}
								</Avatar.Fallback>
							</Avatar.Root>
							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-semibold">{user.name}</span>
								<span class="truncate text-xs">{user.email}</span>
							</div>
						</div>
					</DropdownMenu.Label>
					<DropdownMenu.Separator />
					<DropdownMenu.Group>
						<DropdownMenu.Item>
							<Sparkles />
							Upgrade to Pro
						</DropdownMenu.Item>
					</DropdownMenu.Group>
					<DropdownMenu.Separator />
					<DropdownMenu.Group>
						<DropdownMenu.Item onSelect={() => goto('/app/account')}>
							<User class="mr-2 size-4" />
							Account
						</DropdownMenu.Item>
						<DropdownMenu.Item>
							<CreditCard />
							Billing
						</DropdownMenu.Item>
						<DropdownMenu.Item>
							<Bell />
							Notifications
						</DropdownMenu.Item>
					</DropdownMenu.Group>
					<DropdownMenu.Separator />
					<DropdownMenu.Item onSelect={handleLogout}>
						<LogOut />
						Log out
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
