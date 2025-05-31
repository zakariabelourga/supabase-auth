<script lang="ts">
	import { enhance } from '$app/forms';
	import { type SubmitFunction } from '@sveltejs/kit';
	import type { Entity } from '$lib/types';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { PencilLine, PlusCircle, Trash2, Loader } from '@lucide/svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let { data, form } = $props();
	let { entities } = $derived(data);

	// State for the form (add or edit)
	let showForm = $state(false);
	let editingEntity: Entity | null = $state(null);
	let isSubmitting = $state(false);
	let formRef: HTMLFormElement | null = $state(null);
	let submissionAttempted = $state(false);

	// Compute form mode based on editingEntity state
	let isEditMode = $derived(!!editingEntity);

	// Function to open form for editing
	function startEditing(entity: Entity) {
		editingEntity = entity;
		showForm = true;
		// Ensure form values update if form is already open
		// $form is not directly writable, need to trigger update if necessary
		// Typically, just opening the form with new state is enough due to reactivity
	}

	// Function to close/cancel form
	function cancelForm() {
		showForm = false;
		editingEntity = null;
		// Clear previous form action results if desired
		// This requires more advanced state management or specific handling in $effect
	}

	// Reactive statement to handle form state after submission
	$effect(() => {
		if (submissionAttempted) {
			// A submission was attempted. Now check the 'form' state.
			const isExplicitSuccess =
				form?.status && (form.status === 201 || form.status === 200) && !(form as any)?.values;
			const isImplicitSuccess = form === undefined; // SvelteKit cleared the form after a successful action with no return data

			if (isExplicitSuccess || isImplicitSuccess) {
				cancelForm();
				formRef?.reset();
			}
			// Error on Update: Keep form open and editingEntity set
			else if (form?.status && form.status >= 400 && (form as any)?.values?.isUpdate) {
				// The form remains open due to error, editingEntity remains set
				// Error message is displayed via {#if form?.message}
			}
			// Error on Add: Keep form open, editingEntity remains null
			else if (form?.status && form.status >= 400 && !(form as any)?.values?.isUpdate) {
				// The form remains open due to error, editingEntity is null (correct for add mode)
				// Error message is displayed
			}

			submissionAttempted = false; // Reset the flag after processing this submission's result
		}
	});

	const handleSubmit: SubmitFunction = () => {
		isSubmitting = true;
		submissionAttempted = true; // Signal that a submission is underway
		return async ({ update }) => {
			await update();
			isSubmitting = false;
			// Resetting / closing handled by $effect
		};
	};
</script>

<svelte:head>
	<title>My Entities</title>
</svelte:head>

<PageHeader title="All Entities/Providers" count={entities.length}>
	<Button
		variant="default"
		onclick={() => {
			editingEntity = null; // Ensure add mode
			showForm = !showForm;
		}}
		disabled={showForm && isEditMode}
		class="flex items-center gap-2"
	>
		<PlusCircle class="size-4" />
		<!-- Disable add while editing -->
		{showForm && !isEditMode ? 'Cancel' : 'Add New Entity'}
	</Button>
</PageHeader>

<!-- Add/Edit Entity Form -->
{#if showForm}
	<div class="mb-6 overflow-hidden rounded-lg bg-white shadow-lg">
		<div class="p-6">
			<h2 class="mb-4 text-xl font-semibold">{isEditMode ? 'Edit Entity' : 'Add New Entity'}</h2>
			<form
				method="POST"
				action={isEditMode ? '?/updateEntity' : '?/addEntity'}
				use:enhance={handleSubmit}
				bind:this={formRef}
			>
				{#if form?.message && ((form as any).values?.entityId === editingEntity?.id || !(form as any).values?.isUpdate)}
					<div
						class={`mb-4 rounded-md p-4 ${form.status && form.status < 400 ? 'border border-green-200 bg-green-50 text-green-800' : 'border border-red-200 bg-red-50 text-red-800'}`}
					>
						<span>{form.message}</span>
					</div>
				{/if}

				<!-- Hidden input for ID in edit mode -->
				{#if isEditMode}
					<input type="hidden" name="entityId" value={editingEntity?.id} />
				{/if}

				<div class="mb-4">
					<label for="name" class="mb-1 block text-sm font-medium text-gray-700">
						Entity Name*
					</label>
					<input
						id="name"
						name="name"
						type="text"
						required
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						value={isEditMode
							? ((form as any)?.values?.name ?? editingEntity?.name ?? '')
							: ((form as any)?.values?.name ?? '')}
					/>
				</div>

				<div class="mb-4">
					<label for="description" class="mb-1 block text-sm font-medium text-gray-700">
						Description
					</label>
					<textarea
						id="description"
						name="description"
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						value={isEditMode
							? ((form as any)?.values?.description ?? editingEntity?.description ?? '')
							: ((form as any)?.values?.description ?? '')}
					></textarea>
				</div>

				<div class="flex justify-end space-x-2">
					<Button variant="secondary" onclick={cancelForm} class="flex items-center gap-2">
						Cancel
					</Button>

					<Button
						type="submit"
						disabled={isSubmitting}
						variant="default"
						class="flex items-center gap-2"
					>
						{#if isSubmitting}
							<Loader class="animate-spin" />
						{:else}
							<PlusCircle class="size-4" />
						{/if}
						{isSubmitting
							? isEditMode
								? 'Updating...'
								: 'Adding...'
							: isEditMode
								? 'Update Entity'
								: 'Add Entity'}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Entities List -->
{#if entities.length > 0}
	<div class="overflow-x-auto rounded-lg border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[100px]">Name</Table.Head>
					<Table.Head>Description</Table.Head>
					<Table.Head>Created At</Table.Head>
					<Table.Head>Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each entities as entity, i (entity.id)}
					<Table.Row class={i % 2 === 0 ? 'bg-background' : 'bg-muted'}>
						<Table.Cell class="whitespace-nowrap px-6 py-4">{entity.name}</Table.Cell>
						<Table.Cell class="whitespace-nowrap px-6 py-4">{entity.description ?? '-'}</Table.Cell>
						<Table.Cell class="whitespace-nowrap px-6 py-4"
							>{new Date(entity.created_at).toLocaleDateString()}</Table.Cell
						>
						<Table.Cell class="space-x-2 whitespace-nowrap px-6 py-4">
							<Button
								onclick={() => startEditing(entity)}
								disabled={showForm}
								variant="ghost"
								size="icon"
								class="text-primary hover:text-primary/75"
							>
								<PencilLine />
							</Button>
							<!-- Delete Form -->
							<form
								method="POST"
								action="?/deleteEntity"
								use:enhance
								class="inline"
								onsubmit={() => {
									if (
										!confirm(
											'Are you sure you want to delete this entity? Items using it will be unlinked.'
										)
									) {
										return false; // Prevent form submission if user cancels
									}
									// Allow submission if confirmed (implicitly returns true/undefined)
								}}
							>
								<input type="hidden" name="entityId" value={entity.id} />
								<Button
									type="submit"
									disabled={showForm}
									variant="ghost"
									size="icon"
									class="text-destructive hover:text-destructive/75"
								>
									<Trash2 />
								</Button>
							</form>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
{:else}
	<p class="mt-8 text-center text-gray-500">You haven't created any entities yet.</p>
{/if}
