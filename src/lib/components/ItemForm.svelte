<script lang="ts">
	import { enhance } from '$app/forms';
	import { type SubmitFunction, type ActionResult } from '@sveltejs/kit';
	import Loader from '@lucide/svelte/icons/loader';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import EntityCombobox from '$lib/components/EntityCombobox.svelte';
	import CategoryCombobox from '$lib/components/CategoryCombobox.svelte';
	import type { Category, Entity, Tag, ItemEntry } from '$lib/types';

	// Define a type for the expected form result structure (can be more specific)
	type ItemFormResult = ActionResult & {
		message?: string;
		values?: any;
		status?: number;
		itemUpdatedButTagsFailed?: boolean;
		isUpdate?: boolean; // Flag from update action
	};

	let {
		item = $bindable(null as ItemEntry | null),
		categories = [] as Category[],
		entities = [] as Entity[],
		formResult = $bindable(null as ItemFormResult | null | undefined), // Bindable prop for parent's $form
		open = $bindable(false),
		onOpenChange = $bindable((value: boolean) => {}) // Callback for dialog open state changes
	}: {
		item?: ItemEntry | null;
		categories?: Category[];
		entities?: Entity[];
		formResult?: ItemFormResult | null | undefined;
		open?: boolean;
		onOpenChange?: (value: boolean) => void;
	} = $props();

	// --- Internal Component State ---
	let isSubmitting = $state(false);
	let formRef: HTMLFormElement | null = $state(null);
	let isEditMode = $derived(!!item); // Derived state internal to component

	let selectedCategoryId = $state(''); // This will be bound to CategoryCombobox

	// --- Input State ---
	let nameInputValue = $state('');
	let expirationInputValue = $state('');
	let entityInputValue = $state('');
	let tagsInputValue = $state('');
	let descriptionInputValue = $state('');

	// --- Helper Functions ---
	function formatTagsForInput(tags: Tag[] | undefined | null): string {
		if (!tags) return '';
		return tags.map((t) => t.name).join(', ');
	}
	function getEntityInputValue(currentItem: ItemEntry | null): string {
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

			// If the form was successful, close the dialog
			if (result.type === 'success' && !result.data?.values) {
				onOpenChange(false);
			}
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

<!-- Item form in dialog -->
<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Content class="sm:max-w-[600px]">
		<Dialog.Header>
			<Dialog.Title>{isEditMode ? 'Edit Item' : 'Add New Item'}</Dialog.Title>
			<Dialog.Description>
				{isEditMode
					? 'Update the details of your item below.'
					: 'Fill in the details to add a new item.'}
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action={isEditMode ? '?/updateItem' : '?/addItem'}
			use:enhance={handleSubmit}
			bind:this={formRef}
			class="py-4"
		>

			<!-- Hidden input for ID in edit mode -->
			{#if isEditMode}
				<input type="hidden" name="itemId" value={item?.id} />
			{/if}

			<!-- Hidden input for Category ID -->
			<input type="hidden" name="categoryId" bind:value={selectedCategoryId} />

			<!-- Input Fields -->
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<!-- Item Name -->
				<div class="mb-4">
					<Label for="name">Item Name*</Label>
					<Input
						id="name"
						name="name"
						type="text"
						required
						class="w-full"
						bind:value={nameInputValue}
					/>
				</div>

				<!-- Expiration Date -->
				<div class="mb-4">
					<Label for="expiration">Expiration Date*</Label>
					<Input
						id="expiration"
						name="expiration"
						type="date"
						required
						class="w-full"
						bind:value={expirationInputValue}
					/>
				</div>

				<!-- Entity Input with Combobox Popover -->
				<div class="mb-4">
					<EntityCombobox
						{entities}
						bind:value={entityInputValue}
						name="entityNameManual"
						inputId="entityNameManual"
						label="Provider / Entity"
						placeholder="Type or select an entity"
					/>
				</div>

				<!-- Category Combobox -->
				<div class="mb-4">
					<CategoryCombobox
						{categories}
						bind:selectedId={selectedCategoryId}
						name="categoryId"
						label="Category"
						placeholder="Select a category..."
					/>
				</div>

				<!-- Tags -->
				<div class="mb-4 sm:col-span-2">
					<Label for="tags">Tags (comma-separated)</Label>
					<Input id="tags" name="tags" type="text" class="w-full" bind:value={tagsInputValue} />
				</div>
			</div>

			<!-- Description -->
			<div class="mb-4">
				<Label for="description">Description</Label>
				<Textarea
					id="description"
					name="description"
					class="w-full"
					bind:value={descriptionInputValue}
				></Textarea>
			</div>

			<Dialog.Footer>
				<Button type="submit" disabled={isSubmitting}>
					{#if isSubmitting}
						<Loader class="mr-2 animate-spin" />
					{/if}
					{isSubmitting
						? isEditMode
							? 'Updating...'
							: 'Adding...'
						: isEditMode
							? 'Update Item'
							: 'Add Item'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
