<script lang="ts">
	import { enhance } from '$app/forms';
	import { type SubmitFunction } from '@sveltejs/kit';

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

	// State for the form (add or edit)
	let showForm = $state(false);
	let editingItem: Item | null = $state(null);
	let isSubmitting = $state(false);
	let formRef: HTMLFormElement | null = $state(null);

	// Compute form mode based on editingItem state
	let isEditMode = $derived(!!editingItem);

	// Function to open form for editing
	function startEditing(item: Item) {
		editingItem = item;
		showForm = true;
	}

	// Function to close/cancel form
	function cancelForm() {
		showForm = false;
		editingItem = null;
	}

	// Reactive statement to handle form state after submission
	$effect(() => {
		// Success (Add or Update)
		if ((form?.status === 201 || form?.status === 200) && !(form as any)?.values) {
			cancelForm(); // Close form, clear editing state
			formRef?.reset(); // Reset form fields
			// Handle specific message for tag errors on update
			if ((form as any)?.itemUpdatedButTagsFailed) {
				// Maybe show a more specific success/warning toast
				// alert('Item details updated, but there was an issue with tags.');
			} else if (form?.message) {
				// Show general success message: alert(form.message);
			}
		}
		// Handle errors similarly to entities page (keeping form open)
		else if (form?.status && form.status >= 400) {
			// Keep form open, error message is displayed via {#if form?.message}
		}
	});

	const handleSubmit: SubmitFunction = () => {
		isSubmitting = true;
		return async ({ update }) => {
			await update();
			isSubmitting = false;
			// Resetting/closing handled by $effect
		};
	};

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

<div class="container mx-auto p-4 md:p-8">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">My Expiration Items</h1>
		<button
			onclick={() => {
				editingItem = null; // Ensure add mode
				showForm = !showForm;
			}}
			class="btn btn-primary"
			disabled={showForm && isEditMode}
		> <!-- Disable add while editing-->
			{showForm && !isEditMode ? 'Cancel' : '+ Add New Item'}
		</button>
	</div>

	<!-- Add/Edit Item Form -->
	{#if showForm}
		<div class="card bg-base-200 shadow-xl mb-6">
			<div class="card-body">
				<h2 class="card-title mb-4">{isEditMode ? 'Edit Item' : 'Add New Item'}</h2>
				<form
					method="POST"
					action={isEditMode ? '?/updateItem' : '?/addItem'}
					use:enhance={handleSubmit}
					bind:this={formRef}
				>
					{#if form?.message && ( (form as any).values?.itemId === editingItem?.id || !(form as any).values?.isUpdate )}
						<div
							class={`alert ${ (form?.status && form.status < 400) || (form as any)?.itemUpdatedButTagsFailed ? 'alert-success' : 'alert-error'} mb-4`}
						>
							<span>{form.message}</span>
						</div>
					{/if}

					<!-- Hidden input for ID in edit mode -->
					{#if isEditMode}
						<input type="hidden" name="itemId" value={editingItem?.id} />
					{/if}

					<!-- Item Name -->
					<div class="form-control mb-4">
						<label for="name" class="label">
							<span class="label-text">Item Name*</span>
						</label>
						<input
							id="name"
							name="name"
							type="text"
							required
							class="input input-bordered w-full"
							value={isEditMode ? (form as any)?.values?.name ?? editingItem?.name ?? '' : (form as any)?.values?.name ?? ''}
						/>
					</div>

					<!-- Description -->
					<div class="form-control mb-4">
						<label for="description" class="label">
							<span class="label-text">Description</span>
						</label>
						<textarea
							id="description"
							name="description"
							class="textarea textarea-bordered w-full"
							value={isEditMode ? (form as any)?.values?.description ?? editingItem?.description ?? '' : (form as any)?.values?.description ?? ''}
						></textarea>
					</div>

					<!-- Category -->
					<div class="form-control mb-4">
						<label for="categoryId" class="label">
							<span class="label-text">Category</span>
						</label>
						<select
							id="categoryId"
							name="categoryId"
							class="select select-bordered w-full"
							value={isEditMode ? (form as any)?.values?.categoryId ?? editingItem?.category?.id ?? '' : (form as any)?.values?.categoryId ?? ''}
						>
							<option value="" disabled selected={!(isEditMode ? (form as any)?.values?.categoryId ?? editingItem?.category?.id : (form as any)?.values?.categoryId)}>Select a category</option>
							{#each categories as category}
								<option value={category.id}>{category.name}</option>
							{/each}
						</select>
					</div>

					<!-- Entity Input with Datalist -->
					<div class="form-control mb-4">
						<label for="entityNameManual" class="label">
							<span class="label-text">Provider / Entity</span>
						</label>
						<input
							id="entityNameManual"
							name="entityNameManual"
							type="text"
							class="input input-bordered w-full"
							list="entities-list"
							placeholder="Type or select an entity"
							value={isEditMode ? (form as any)?.values?.entityNameManual ?? getEntityInputValue(editingItem) : (form as any)?.values?.entityNameManual ?? ''}
						/>
						<datalist id="entities-list">
							{#each entities as entity}
								<option value={entity.name}>{entity.description ? `${entity.name} (${entity.description})` : entity.name}</option>
							{/each}
						</datalist>
					</div>

					<!-- Tags -->
					<div class="form-control mb-4">
						<label for="tags" class="label">
							<span class="label-text">Tags (comma-separated)</span>
						</label>
						<input
							id="tags"
							name="tags"
							type="text"
							class="input input-bordered w-full"
							value={isEditMode ? (form as any)?.values?.tagsString ?? formatTagsForInput(editingItem?.tags ?? []) : (form as any)?.values?.tagsString ?? ''}
						/>
					</div>

					<!-- Expiration Date -->
					<div class="form-control mb-4">
						<label for="expiration" class="label">
							<span class="label-text">Expiration Date*</span>
						</label>
						<input
							id="expiration"
							name="expiration"
							type="date"
							required
							class="input input-bordered w-full"
							value={isEditMode ? (form as any)?.values?.expiration ?? formatDateForInput(editingItem?.expiration) : (form as any)?.values?.expiration ?? ''}
						/>
					</div>

					<div class="card-actions justify-end">
						<button type="button" onclick={cancelForm} class="btn btn-ghost">Cancel</button>
						<button type="submit" class="btn btn-primary" disabled={isSubmitting}>
							{#if isSubmitting} <span class="loading loading-spinner"></span> {/if}
							{isSubmitting ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Item' : 'Add Item')}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if items.length > 0}
		<div class="overflow-x-auto">
			<table class="table table-zebra w-full">
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
										<span class="badge badge-outline mr-1">{tag.name}</span>
									{/each}
								{:else}
									-
								{/if}
							</td>
							<td>{new Date(item.expiration).toLocaleDateString()}</td>
							<td>
								<button
									class="btn btn-xs btn-ghost"
									onclick={() => startEditing(item)}
									disabled={showForm}
								> <!-- Disable while form is open -->
									Edit
								</button>
								<!-- Delete Item Form -->
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
										class="btn btn-xs btn-ghost text-error"
										disabled={showForm}
									> <!-- Disable while form is open-->
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
		<p class="text-center text-gray-500 mt-8">
			You haven't added any items yet.
		</p>
	{/if}
</div>

<style>
	/* Add any component-specific styles here */
</style> 