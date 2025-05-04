<script lang="ts">
	import { enhance } from '$app/forms';
	import { type SubmitFunction } from '@sveltejs/kit';
	import type { ActionResult } from '@sveltejs/kit';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import Check from '@lucide/svelte/icons/check';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import { tick } from 'svelte';
	import { cn } from '$lib/utils.js';
	import Loader from '@lucide/svelte/icons/loader';

	// --- Component Props ---
	type Category = { id: string; name: string };
	type Entity = { id: string; name: string; description: string | null };
	type ItemTag = { id: string; name: string };
	type Item = {
		id: string;
		name: string;
		description: string | null;
		expiration: string;
		category: { id: string; name: string } | null;
		tags: ItemTag[];
		entity: { id: string; name: string } | null;
		entity_name_manual: string | null;
	} | null;

	// Define a type for the expected form result structure (can be more specific)
	type ItemFormResult = ActionResult & {
		message?: string;
		values?: any;
		status?: number;
		itemUpdatedButTagsFailed?: boolean;
		isUpdate?: boolean; // Flag from update action
	};

	let {
		item = $bindable(null),
		categories = [] as Category[], // Use plain default array
		entities = [] as Entity[], // Use plain default array
		formResult = $bindable(null as ItemFormResult | null | undefined) // Bindable prop for parent's $form
	}: {
		item?: Item | null;
		categories?: Category[];
		entities?: Entity[];
		formResult?: ItemFormResult | null | undefined;
	} = $props();

	// --- Internal Component State ---
	let isSubmitting = $state(false);
	let formRef: HTMLFormElement | null = $state(null);
	let isEditMode = $derived(!!item); // Derived state internal to component

	// --- Category Combobox State ---
	let categoryComboboxOpen = $state(false);
	let selectedCategoryId = $state('');
	let categoryTriggerRef = $state<HTMLButtonElement | null>(null);

	const selectedCategoryName = $derived(categories.find((c) => c.id === selectedCategoryId)?.name);

	function closeCategoryComboboxAndFocusTrigger() {
		categoryComboboxOpen = false;
		tick().then(() => {
			categoryTriggerRef?.focus();
		});
	}
	// --- End Category Combobox State ---

	// --- Input State ---
	let nameInputValue = $state('');
	let expirationInputValue = $state('');
	let entityInputValue = $state('');
	let tagsInputValue = $state('');
	let descriptionInputValue = $state('');
	// --- End Input State ---

	// --- Helper Functions ---
	function formatTagsForInput(tags: ItemTag[] | undefined | null): string {
		if (!tags) return '';
		return tags.map((t) => t.name).join(', ');
	}
	function getEntityInputValue(currentItem: Item | null): string {
		if (!currentItem) return '';
		return currentItem.entity?.name ?? currentItem.entity_name_manual ?? '';
	}
	function formatDateForInput(dateString: string | null | undefined): string {
		if (!dateString) return '';
		try {
			const date = new Date(dateString);
			const year = date.getFullYear();
			const month = (date.getMonth() + 1).toString().padStart(2, '0');
			const day = date.getDate().toString().padStart(2, '0');
			return `${year}-${month}-${day}`;
		} catch (e) {
			console.error('Error formatting date:', e);
			return '';
		}
	}

	// --- Form Submission Handling ---
	const handleSubmit: SubmitFunction = () => {
		isSubmitting = true;
		return async ({ result, update }) => {
			// Wait for SvelteKit to process the action result and update $form
			await update();
			// Now that the update is done, explicitly reset the submitting state
			isSubmitting = false;
			// Parent page handles closing the form via its $effect
		};
	};

	// Reactive derived state for form values from the parent's $form prop
	let formValues = $derived(formResult?.values);

	// --- Effects ---
	// Effect to initialize selectedCategoryId based on formValues or item props
	$effect(() => {
		// Prioritize formValues if they exist (e.g., after form submission error)
		if (formValues?.categoryId) {
			selectedCategoryId = formValues.categoryId;
		}
		// Otherwise, use the item prop if in edit mode and it has a category
		else if (isEditMode && item?.category?.id) {
			selectedCategoryId = item.category.id;
		}
		// Default to empty if neither applies (add mode initially, or edit mode with no category)
		else if (!selectedCategoryId) {
			// Only reset if not already set by one of the above
			selectedCategoryId = '';
		}
	});

	// Effect to manage input values based on form/item changes
	$effect(() => {
		// Update nameInputValue based on form errors or item prop
		nameInputValue = formValues?.name ?? (isEditMode && item ? (item.name ?? '') : '');
		expirationInputValue =
			formValues?.expiration ??
			(isEditMode && item ? (formatDateForInput(item.expiration) ?? '') : '');
		entityInputValue =
			formValues?.entityNameManual ?? (isEditMode && item ? (getEntityInputValue(item) ?? '') : '');
		tagsInputValue =
			formValues?.tagsString ?? (isEditMode && item ? (formatTagsForInput(item.tags) ?? '') : '');
		descriptionInputValue =
			formValues?.description ?? (isEditMode && item ? (item.description ?? '') : '');
	});
</script>

<!-- Add/Edit Item Form Component -->
<Card.Root>
	<Card.Header>
		<Card.Title>{isEditMode ? 'Edit Item' : 'Add New Item'}</Card.Title>
		<Card.Description>Card Description</Card.Description>
	</Card.Header>
	<Card.Content>
		<form
			method="POST"
			action={isEditMode ? '?/updateItem' : '?/addItem'}
			use:enhance={handleSubmit}
			bind:this={formRef}
		>
			<!-- Action determined by parent page context -->
			<!-- Display Message from Parent ($form / formResult prop) -->
			{#if formResult?.message && ((formValues?.itemId === item?.id && isEditMode) || (!isEditMode && !formValues?.isUpdate) || formValues?.isUpdate === isEditMode)}
				<div
					class={`alert ${(formResult.status && formResult.status < 400) || formResult.itemUpdatedButTagsFailed ? 'alert-success' : 'alert-error'} mb-4`}
				>
					<span>{formResult.message}</span>
				</div>
			{/if}

			<!-- Hidden input for ID in edit mode -->
			{#if isEditMode}
				<input type="hidden" name="itemId" value={item?.id} />
			{/if}

			<!-- Hidden input for Category ID -->
			<input type="hidden" name="categoryId" bind:value={selectedCategoryId} />

			<div class="flex justify-between">
				<!-- Item Name -->
				<div class="form-control mb-4 w-[200px]">
					<Label for="name">Item Name*</Label>
					<Input
						id="name"
						name="name"
						type="text"
						required
						class="input input-bordered w-full"
						bind:value={nameInputValue}
					/>
				</div>

				<!-- Expiration Date -->
				<div class="form-control mb-4">
					<Label for="expiration">Expiration Date*</Label>
					<Input
						id="expiration"
						name="expiration"
						type="date"
						required
						class="input input-bordered w-full"
						bind:value={expirationInputValue}
					/>
				</div>

				<!-- Entity Input with Datalist -->
				<div class="form-control mb-4 w-[200px]">
					<Label for="entityNameManual">Provider / Entity</Label>
					<Input
						id="entityNameManual"
						name="entityNameManual"
						type="text"
						class="input input-bordered w-full"
						list="entities-list"
						placeholder="Type or select an entity"
						bind:value={entityInputValue}
					/>
					<datalist id="entities-list">
						{#each entities as entity}
							<option value={entity.name}
								>{entity.description
									? `${entity.name} (${entity.description})`
									: entity.name}</option
							>
						{/each}
					</datalist>
				</div>

				<!-- Category Combobox -->
				<div class="form-control mb-4 w-[200px]">
					<Label>Category</Label>
					<Popover.Root bind:open={categoryComboboxOpen}>
						<Popover.Trigger class="w-full" bind:ref={categoryTriggerRef}>
							<Button
								variant="outline"
								role="combobox"
								aria-expanded={categoryComboboxOpen}
								class="w-full justify-between"
							>
								{selectedCategoryName || 'Select a category...'}
								<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
							</Button>
						</Popover.Trigger>
						<Popover.Content class="w-[--radix-popover-trigger-width] p-0">
							<Command.Root>
								<Command.Input placeholder="Search category..." />
								<Command.List>
									<Command.Empty>No category found.</Command.Empty>
									<Command.Group>
										<!-- Option for no category -->
										<Command.Item
											value=""
											onSelect={() => {
												selectedCategoryId = '';
												closeCategoryComboboxAndFocusTrigger();
											}}
										>
											<Check
												class={cn('mr-2 size-4', selectedCategoryId !== '' && 'text-transparent')}
											/>
											(No Category)
										</Command.Item>
										<!-- Loop through categories -->
										{#each categories as category (category.id)}
											<Command.Item
												value={category.id}
												onSelect={() => {
													selectedCategoryId = category.id;
													closeCategoryComboboxAndFocusTrigger();
												}}
											>
												<Check
													class={cn(
														'mr-2 size-4',
														selectedCategoryId !== category.id && 'text-transparent'
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

				<!-- Tags -->
				<div class="form-control mb-4 w-[200px]">
					<Label for="tags">Tags (comma-separated)</Label>
					<Input
						id="tags"
						name="tags"
						type="text"
						class="input input-bordered w-full"
						bind:value={tagsInputValue}
					/>
				</div>
			</div>

			<!-- Description -->
			<div class="form-control mb-4">
				<Label for="description">Description</Label>
				<Textarea
					id="description"
					name="description"
					class="textarea textarea-bordered w-full"
					bind:value={descriptionInputValue}
				></Textarea>
			</div>

			<div class="mt-8 flex justify-between">
				<!-- Cancel button is handled by the parent page -->
				<Button type="submit" class="btn btn-primary" disabled={isSubmitting}>
					{#if isSubmitting}
						<Loader class="animate-spin" />
					{/if}
					{isSubmitting
						? isEditMode
							? 'Updating...'
							: 'Adding...'
						: isEditMode
							? 'Update Item'
							: 'Add Item'}
				</Button>
			</div>
		</form>
	</Card.Content>
</Card.Root>
