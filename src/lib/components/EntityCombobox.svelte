<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import Check from '@lucide/svelte/icons/check';
	import Building2 from '@lucide/svelte/icons/building-2'; // Using Building2 as per your latest changes
	import { tick } from 'svelte';
	import { cn } from '$lib/utils.js';

	type Entity = { id: string; name: string; description: string | null };

	let {
		entities = [] as Entity[],
		value = $bindable(''),
		label = 'Provider / Entity',
		name = 'entityNameManual', // Name for the form input
		placeholder = 'Type or select an entity',
		inputId = 'entityNameManual'
	}: {
		entities?: Entity[];
		value?: string;
		label?: string;
		name?: string;
		placeholder?: string;
		inputId?: string;
	} = $props();

	let comboboxOpen = $state(false);
	let searchValue = $state(''); // For the search input within the command
	let triggerRef = $state<HTMLButtonElement | null>(null);
	let inputFieldRef = $state<HTMLInputElement | null>(null); // Ref for the actual text input

	const filteredEntities = $derived(
		entities.filter(
			(entity) =>
				entity.name.toLowerCase().includes(searchValue.toLowerCase()) ||
				(entity.description && entity.description.toLowerCase().includes(searchValue.toLowerCase()))
		)
	);

	function closeComboboxAndFocusInput() {
		comboboxOpen = false;
		// searchValue = ''; // Clear search on close, consider if this is desired UX
		tick().then(() => {
			inputFieldRef?.focus();
		});
	}

	function handleInput() {
		// If user types, ensure combobox might open or filter
		// This could also be on:focus to open immediately
		if (!comboboxOpen && value.length > 0) {
			// comboboxOpen = true; // Optionally open on type
		}
		// Clear search if input is cleared manually by typing
		if (value === '') {
			searchValue = '';
		}
	}
</script>

<div class="form-control">
	{#if label}
		<Label for={inputId}>{label}</Label>
	{/if}
	<div class="relative flex items-center">
		<Input
			bind:ref={inputFieldRef}
			id={inputId}
			{name}
			type="text"
			class="input input-bordered w-full pr-10"
			{placeholder}
			bind:value
			oninput={handleInput}
		/>
		<Popover.Root bind:open={comboboxOpen}>
			<Popover.Trigger
				bind:ref={triggerRef}
				class="absolute right-0 top-0 h-full border-l hover:bg-muted border rounded rounded-l-none px-3"
				aria-label="Toggle entity list"
			>
				<Building2 class="size-4 opacity-50" />
			</Popover.Trigger>
			<Popover.Content class="p-0 w-[--radix-popover-trigger-width]" sideOffset={5}>
				<Command.Root>
					<Command.Input
						placeholder="Search entity..."
						bind:value={searchValue}
						onkeydown={(e) => {
							if (e.key === 'Escape' && !searchValue) {
								e.preventDefault();
								closeComboboxAndFocusInput();
							}
						}}
					/>
					<Command.List>
						<Command.Empty>No entity found.</Command.Empty>
						<Command.Group>
							{#each filteredEntities as entity (entity.id)}
								<Command.Item
									value={entity.name}
									onSelect={() => {
										value = entity.name;
										searchValue = ''; // Clear search after selection
										closeComboboxAndFocusInput();
									}}
								>
									<Check
										class={cn('mr-2 size-4', value === entity.name ? '' : 'text-transparent')}
									/>
									{entity.name}
									{#if entity.description}
										<span class="ml-2 text-xs text-muted-foreground">({entity.description})</span>
									{/if}
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.List>
				</Command.Root>
			</Popover.Content>
		</Popover.Root>
	</div>
</div> 