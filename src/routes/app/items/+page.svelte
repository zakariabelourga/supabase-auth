<script lang="ts">
	import { enhance } from '$app/forms';
	import { type ActionResult } from '@sveltejs/kit';
	import ItemForm from '$lib/components/ItemForm.svelte';
	import PlusCircle from '@lucide/svelte/icons/plus-circle';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { ItemEntry as Item } from '$lib/types';
	import { toast } from 'svelte-sonner';

	// Define FormActionData for this page's actions
	interface AddItemFormValues {
		name?: string | null;
		description?: string | null;
		categoryId?: string | null;
		expiration?: string | null;
		tagsString?: string | null;
		entityNameManual?: string | null;
	}

	interface ItemsPageFormActionData {
		message?: string;
		// addItem specific
		values?: AddItemFormValues;
		itemId?: string; // for new item ID
		itemAddedButTagsFailed?: boolean;
		// deleteItem specific
		deletedItemId?: string;
		deleteErrorId?: string; // To associate error with a specific item being deleted
		// General status from direct returns (like 200, 201) will be on form itself
	}

	let {
		data,
		form
	}: {
		data: any;
		form: ActionResult<Partial<ItemsPageFormActionData>, Partial<ItemsPageFormActionData>> | null;
	} = $props();
	
	let { items, categories, entities } = $derived(data);

	// Helper to get data from form result (adapted from [itemId] page)
	const getFormActionData = (
		actionResult: ActionResult<
			Partial<ItemsPageFormActionData>,
			Partial<ItemsPageFormActionData>
		> | null
	): Partial<ItemsPageFormActionData> | null => {
		if (!actionResult) return null;
		if (actionResult.type === 'success' || actionResult.type === 'failure') {
			return actionResult.data ?? {};
		}
		if (actionResult.type === 'error') {
			console.error('ActionResult type error on items page:', actionResult.error);
			return {};
		}
		if (typeof actionResult.type === 'undefined') {
			// Direct return from action
			return actionResult as Partial<ItemsPageFormActionData>;
		}
		return {};
	};

	let currentFormActionData = $derived(getFormActionData(form));

	// State for the add item dialog
	let showAddDialog = $state(false);

	function handleAddDialogOpenChange(open: boolean) {
		showAddDialog = open;
	}

	// Reactive statement to close form on successful ADDITION
	$effect(() => {
		if (form?.status === 201 && !currentFormActionData?.values) {
			// 201 Created from addItem
			showAddDialog = false;
		}
	});

	// Effect to show toast messages
	$effect(() => {
		const actionData = currentFormActionData;
		const pageForm = form; // To access top-level status for direct returns

		if (!actionData?.message) return;

		// Add Item Success
		if (pageForm?.status === 201 && actionData.itemId) {
			toast.success(actionData.message);
		}
		// Delete Item Success
		else if (pageForm?.status === 200 && actionData.deletedItemId) {
			toast.success(actionData.message);
		}
		// Add Item Failure (validation or tags failed) or Delete Item Failure
		else if (pageForm?.type === 'failure' || actionData.itemAddedButTagsFailed) {
			toast.error(actionData.message);
		}
	});

	// Helper function to get display name for entity
	function getEntityDisplayName(item: Item): string {
		return item.entity?.name ?? item.entity_name_manual ?? '-';
	}
</script>

<svelte:head>
	<title>My Items</title>
</svelte:head>

<!-- Item Form Dialog -->
<ItemForm
	item={null}
	{categories}
	{entities}
	formResult={form}
	bind:open={showAddDialog}
	onOpenChange={handleAddDialogOpenChange}
/>

<div class="container mx-auto p-4 md:p-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">My Expiration Items</h1>
		<Button
			variant="default"
			onclick={() => (showAddDialog = true)}
			class="flex items-center gap-2"
		>
			<PlusCircle class="size-4" /> Add New Item
		</Button>
	</div>

	{#if items.length > 0}
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr>
						<th>Name</th>
						<th>Description</th>
						<th>Provider/Entity</th>
						<th>Category</th>
						<th>Tags</th>
						<th>Expires On</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each items as item (item.id)}
						<tr>
							<td>{item.name}</td>
							<td>{item.description ?? '-'}</td>
							<td>{getEntityDisplayName(item)}</td>
							<td>{item.category?.name ?? '-'}</td>
							<td>
								{#if item.tags && item.tags.length > 0}
									{#each item.tags as tag (tag.id)}
										<span class="mr-1">{tag.name}</span>
									{/each}
								{:else}
									-
								{/if}
							</td>
							<td>{new Date(item.expiration).toLocaleDateString()}</td>
							<td>
								<a
									href={`/app/items/${item.id}`}
									class="inline-flex items-center rounded px-2 py-1 text-xs hover:bg-gray-100"
									>View</a
								>
								<form
									method="POST"
									action="?/deleteItem"
									use:enhance
									style="display: inline;"
									onsubmit={() => {
										if (!confirm('Are you sure you want to delete this item?')) {
											return false; // Prevent submission
										}
									}}
								>
									<input type="hidden" name="itemId" value={item.id} />
									<button
										type="submit"
										class="inline-flex items-center rounded px-2 py-1 text-xs text-red-600 hover:bg-gray-100"
									>
										Delete
									</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="rounded-lg border bg-muted/30 p-10 text-center">
			<p class="mb-4 text-muted-foreground">You haven't added any items yet.</p>
			<Button variant="outline" onclick={() => (showAddDialog = true)}>Add Your First Item</Button>
		</div>
	{/if}
</div>
