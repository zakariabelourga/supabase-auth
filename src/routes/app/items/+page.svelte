<script lang="ts">
	import { enhance } from '$app/forms';
	import { type SubmitFunction } from '@sveltejs/kit';

	let { data, form } = $props();
	let { items, categories } = $derived(data);

	// State for the add item form
	let showAddForm = $state(false);
	let isSubmitting = $state(false);

	// Reactive statement to clear form errors/values when the form is submitted successfully
	$effect(() => {
		if ((form as any)?.message && !(form as any)?.values) {
			// Potentially show a success toast/message here based on form.message
			// if (form.message === 'Item added successfully') { ... }
			// For now, just close the form on success or specific known non-error messages
			if (!(form as any)?.itemAddedButTagsFailed) {
				showAddForm = false;
			}
		}
	});

	const handleSubmit: SubmitFunction = () => {
		isSubmitting = true;
		// Optionally return an ({ update }) function to control UI updates
		return async ({ update }) => {
			await update(); // Wait for SvelteKit to update form state and potentially page data
			isSubmitting = false;
			// Optionally reset form fields here IF the form didn't close automatically
			// and IF there was no error (i.e., form?.values is null/undefined)
			// if (!form?.values && showAddForm) { ... reset fields ... }
		};
	};
</script>

<svelte:head>
	<title>My Items</title>
</svelte:head>

<div class="container mx-auto p-4 md:p-8">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">My Expiration Items</h1>
		<button
			onclick={() => (showAddForm = !showAddForm)}
			class="btn btn-primary"
		>
			{showAddForm ? 'Cancel' : '+ Add New Item'}
		</button>
	</div>

	{#if showAddForm}
		<div class="card bg-base-200 shadow-xl mb-6">
			<div class="card-body">
				<h2 class="card-title mb-4">Add New Item</h2>
				<form method="POST" action="?/addItem" use:enhance={handleSubmit}>
					{#if form?.message}
						<div
							class={`alert ${ (form as any)?.values || (form as any)?.itemAddedButTagsFailed ? 'alert-error' : 'alert-success' } mb-4`}
						>
							<span>{form.message}</span>
						</div>
					{/if}

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
							value={(form as any)?.values?.name ?? ''}
						/>
					</div>

					<div class="form-control mb-4">
						<label for="description" class="label">
							<span class="label-text">Description</span>
						</label>
						<textarea
							id="description"
							name="description"
							class="textarea textarea-bordered w-full"
							value={(form as any)?.values?.description ?? ''}
						></textarea>
					</div>

					<div class="form-control mb-4">
						<label for="categoryId" class="label">
							<span class="label-text">Category</span>
						</label>
						<select
							id="categoryId"
							name="categoryId"
							class="select select-bordered w-full"
							value={(form as any)?.values?.categoryId ?? ''}
						>
							<option value="" disabled selected={!(form as any)?.values?.categoryId}>Select a category</option>
							{#each categories as category}
								<option value={category.id}>{category.name}</option>
							{/each}
						</select>
					</div>

					<div class="form-control mb-4">
						<label for="tags" class="label">
							<span class="label-text">Tags (comma-separated)</span>
						</label>
						<input
							id="tags"
							name="tags"
							type="text"
							class="input input-bordered w-full"
							value={(form as any)?.values?.tagsString ?? ''}
						/>
					</div>

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
							value={(form as any)?.values?.expiration ?? ''}
						/>
					</div>

					<div class="card-actions justify-end">
						<button type="button" onclick={() => (showAddForm = false)} class="btn btn-ghost">Cancel</button>
						<button type="submit" class="btn btn-primary" disabled={isSubmitting}>
							{#if isSubmitting} <span class="loading loading-spinner"></span> {/if}
							{isSubmitting ? 'Adding...' : 'Add Item'}
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
						<th>Category</th>
						<th>Tags</th>
						<th>Expires On</th>
						<th>Actions</th> <!-- Placeholder for Edit/Delete -->
					</tr>
				</thead>
				<tbody>
					{#each items as item (item.id)}
						<tr>
							<td>{item.name}</td>
							<td>{item.description ?? '-'}</td>
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
								<!-- Action buttons will go here -->
								<button class="btn btn-xs btn-ghost">Edit</button>
								<button class="btn btn-xs btn-ghost text-error">Delete</button>
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