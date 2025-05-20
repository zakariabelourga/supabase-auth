<script lang="ts">
	import { type ActionResult } from '@sveltejs/kit';
	import ItemForm from '$lib/components/ItemForm.svelte'; // Import the form component
	import ItemDetailsCard from '$lib/components/ItemDetailsCard.svelte'; // Import the new component
	import ItemNotesSection from '$lib/components/ItemNotesSection.svelte'; // Import the new notes section component
	// import * as Alert from '$lib/components/ui/alert/index.js'; // No longer needed here
	import { toast } from 'svelte-sonner'; // Import toast
	import type { PageData } from './+page.server'; // Import PageData

	// Define a type for the custom content within our form actions
	interface ItemFormValues {
		itemId?: string;
		name?: string | null;
		description?: string | null;
		categoryId?: string | null;
		expiration?: string | null;
		tagsString?: string | null;
		entityNameManual?: string | null;
	}

	interface FormActionData {
		message?: string; 
		values?: ItemFormValues; 
		isUpdate?: boolean; 

		itemUpdateSuccess?: boolean;
		itemUpdateError?: string;
		itemUpdatedButTagsFailed?: boolean;

		noteSuccess?: string;
		noteError?: string;
		noteText?: string; 

		noteUpdateSuccess?: string;
		noteUpdateError?: string;
		errorNoteId?: string; 

		noteDeleteSuccess?: string;
		noteDeleteError?: string;
	}

	let { data, form }: { data: PageData; form: ActionResult<Partial<FormActionData>, Partial<FormActionData>> | null } = $props();
	let { item, categories, entities } = $derived(data);

	// Helper to get data from form result, whether success or failure
	const getFormActionData = (actionResult: ActionResult<Partial<FormActionData>, Partial<FormActionData>> | null): Partial<FormActionData> | null => {
		if (!actionResult) return null;

		// If the actionResult has a 'type' property, it's a standard ActionResult (e.g., from fail())
		if (actionResult.type === 'success' || actionResult.type === 'failure') {
			return actionResult.data ?? {};
		}
		// If it's an 'error' type from SvelteKit (rare for form actions unless something went very wrong)
		if (actionResult.type === 'error') {
			console.error('ActionResult type error on page:', actionResult.error);
			return {};
		}
		// If actionResult does NOT have a 'type' property, it's likely a direct success object
		// from a server action (like our itemUpdateSuccess case).
		// In this scenario, the actionResult *is* the data.
		if (typeof actionResult.type === 'undefined') { // Check if 'type' is missing
			return actionResult as Partial<FormActionData>; // Cast it, as it should match our expected success data
		}

		return {}; // Default fallback
	};

	let currentFormActionData = $derived(getFormActionData(form));

	// $effect(() => {
	// 	console.log('Page form state updated:', form);
	// });
	// $effect(() => {
	// 	console.log('Page currentFormActionData updated:', currentFormActionData);
	// });

	// Effect to show toast messages for item updates
	$effect(() => {
		// Check for a new, valid message before toasting to avoid duplicates on form prop re-evaluation
		const message = currentFormActionData?.message;
		const error = currentFormActionData?.itemUpdateError;

		if (currentFormActionData?.itemUpdateSuccess && message) {
			toast.success(message);
			// Optionally, clear the message from form after showing to prevent re-triggering
			// This would require making form mutable or handling it in getFormActionData/currentFormActionData logic
			// For now, relying on distinct message content for new toasts.
		} else if (error) {
			toast.error(error);
		}
	});

	// Dialog state for item form
	let showItemDialog = $state(false);
	
	function handleItemFormOpenChange(open: boolean) {
		showItemDialog = open;
	}

	$effect(() => {
		// Close item form on successful item update
		if (currentFormActionData?.itemUpdateSuccess) {
			showItemDialog = false; // Hide form after successful update
		}
	});
</script>

<svelte:head>
	<title>Item: {item.name}</title>
</svelte:head>


<!-- Item Form Dialog -->
<ItemForm 
	{item} 
	{categories} 
	{entities} 
	formResult={form} 
	bind:open={showItemDialog}
	onOpenChange={handleItemFormOpenChange}
/>

<div class="container mx-auto p-4 md:p-8">
	<a href="/app/items" class="btn btn-ghost mb-6">&larr; Back to Items</a>

	<h1 class="mb-6 text-3xl font-bold">Item Details</h1>


	<!-- Item Details Card -->
	<ItemDetailsCard item={item} onEdit={() => showItemDialog = true} />

	<!-- Item Notes Section Component -->
	<ItemNotesSection notes={item.item_notes} itemId={item.id} pageForm={form} />
</div>
