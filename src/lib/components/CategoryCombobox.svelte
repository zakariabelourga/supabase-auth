<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import Check from '@lucide/svelte/icons/check';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import { tick } from 'svelte';
	import { cn } from '$lib/utils.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { Category } from '$lib/types';

	let {
		categories = [] as Category[],
		selectedId = $bindable(''), // Bindable prop for the selected category ID
		label = 'Category',
		name = 'categoryId', // Name for the hidden input for form submission
		placeholder = 'Select a category...'
	}: {
		categories?: Category[];
		selectedId?: string;
		label?: string;
		name?: string;
		placeholder?: string;
	} = $props();

	let comboboxOpen = $state(false);
	let searchValue = $state('');
	let triggerRef = $state<HTMLButtonElement | null>(null);

	const selectedCategoryName = $derived(
		categories.find((c) => c.id === selectedId)?.name ?? ''
	);

	const filteredCategories = $derived(
		categories.filter((category) =>
			category.name.toLowerCase().includes(searchValue.toLowerCase())
		)
	);

	function closeComboboxAndFocusTrigger() {
		comboboxOpen = false;
		searchValue = ''; // Clear search on close
		tick().then(() => {
			triggerRef?.focus();
		});
	}
</script>

<div>
	{#if label}
		<Label for={triggerRef?.id}>{label}</Label>
	{/if}
	<!-- Hidden input for Category ID for form submission -->
	<input type="hidden" {name} bind:value={selectedId} />

	<Popover.Root bind:open={comboboxOpen}>
		<Popover.Trigger class="w-full" bind:ref={triggerRef}>
			<Button
				variant="outline"
				role="combobox"
				aria-expanded={comboboxOpen}
				class="w-full justify-between"
			>
				{selectedCategoryName || placeholder}
				<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
			</Button>
		</Popover.Trigger>
		<Popover.Content class="w-[--radix-popover-trigger-width] p-0">
			<Command.Root shouldFilter={false}>
				<Command.Input placeholder="Search category..." bind:value={searchValue} />
				<Command.List>
					<Command.Empty>No category found.</Command.Empty>
					<Command.Group>
						<!-- Option for no category -->
						<Command.Item
							value=""
							onSelect={() => {
								selectedId = '';
								closeComboboxAndFocusTrigger();
							}}
						>
							<Check class={cn('mr-2 size-4', selectedId !== '' && 'text-transparent')} />
							(No Category)
						</Command.Item>
						<!-- Loop through filtered categories -->
						{#each filteredCategories as category (category.id)}
							<Command.Item
								value={category.id} 
								onSelect={() => {
									selectedId = category.id;
									closeComboboxAndFocusTrigger();
								}}
							>
								<Check
									class={cn(
										'mr-2 size-4',
										selectedId !== category.id && 'text-transparent'
									)}
								/>
								{category.name}
							</Command.Item>
						{/each}
					</Command.Group>
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
</div>