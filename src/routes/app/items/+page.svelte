<script lang="ts">
	import { enhance } from '$app/forms';
	import { type SubmitFunction } from '@sveltejs/kit';
	import ItemForm from '$lib/components/ItemForm.svelte';
	import PlusCircle from '@lucide/svelte/icons/plus-circle';
	import { Button } from '$lib/components/ui/button/index.js';

	// Define Item type matching the server load more closely
	type Item = {
		id: string;
		name: string;
		description: string | null;
		expiration: string;
		created_at: string;
		updated_at: string;
		category: { id: string; name: string } | null;
		tags: { id: string; name: string }[];
		entity: { id: string; name: string } | null;
		entity_name_manual: string | null;
	};

	let { data, form } = $props();
	let { items, categories, entities } = $derived(data);

	// State for the add item dialog
	let showAddDialog = $state(false);
	
	function handleAddDialogOpenChange(open: boolean) {
		showAddDialog = open;
	}

	// Reactive statement to close form on successful ADDITION
	$effect(() => {
		if (form?.status === 201 && !(form as any)?.values) { // 201 Created
			showAddDialog = false;
		}
	});

	// Helper function to get display name for entity
	function getEntityDisplayName(item: Item): string {
		return item.entity?.name ?? item.entity_name_manual ?? '-';
	}

	// Helper function to format tags for the input field
	function formatTagsForInput(tags: { name: string }[]): string {
		return tags.map(t => t.name).join(', ');
	}

	// Helper function to get the value for the entity input/datalist
	function getEntityInputValue(item: Item | null): string {
		if (!item) return '';
		return item.entity?.name ?? item.entity_name_manual ?? '';
	}

	// Helper to format date for input type="date"
	function formatDateForInput(dateString: string | null | undefined): string {
		if (!dateString) return '';
		try {
			const date = new Date(dateString);
			// Adjust for timezone offset to get YYYY-MM-DD in local time
			const year = date.getFullYear();
			const month = (date.getMonth() + 1).toString().padStart(2, '0');
			const day = date.getDate().toString().padStart(2, '0');
			return `${year}-${month}-${day}`;
		} catch (e) {
			console.error("Error formatting date:", e);
			return ''; // Fallback
		}
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
	formResult={form as any}
	bind:open={showAddDialog}
	onOpenChange={handleAddDialogOpenChange}
/>

<div class="container mx-auto p-4 md:p-8">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">My Expiration Items</h1>
		<Button 
			variant="default" 
			onclick={() => showAddDialog = true}
			class="flex items-center gap-2"
		>
			<PlusCircle class="size-4" /> Add New Item
		</Button>
	</div>

	{#if form?.message && form?.status !== 201}
		<div class={`p-4 mb-4 rounded-md ${form.status && form.status < 400 ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
			<span>{form.message}</span>
		</div>
	{/if}

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
								<a href={`/app/items/${item.id}`} class="inline-flex items-center px-2 py-1 text-xs rounded hover:bg-gray-100">View</a>
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
										class="inline-flex items-center px-2 py-1 text-xs rounded hover:bg-gray-100 text-red-600"
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
		<div class="text-center p-10 border rounded-lg bg-muted/30">
			<p class="text-muted-foreground mb-4">
				You haven't added any items yet.
			</p>
			<Button variant="outline" onclick={() => showAddDialog = true}>Add Your First Item</Button>
		</div>
	{/if}
</div>