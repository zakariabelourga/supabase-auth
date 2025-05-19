<script lang="ts">
	import { enhance } from '$app/forms';
	import { type SubmitFunction, type ActionResult } from '@sveltejs/kit';
	import ItemForm from '$lib/components/ItemForm.svelte'; // Import the form component
	import ItemDetailsCard from '$lib/components/ItemDetailsCard.svelte'; // Import the new component
	import Trash2 from '@lucide/svelte/icons/trash-2'; // Icon for delete
	import PencilLine from '@lucide/svelte/icons/pencil-line'; // Icon for edit
	import Save from '@lucide/svelte/icons/save'; // Icon for save
	import X from '@lucide/svelte/icons/x'; // Icon for cancel
	import Loader from '@lucide/svelte/icons/loader';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
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
		if (actionResult.type === 'success') {
			return actionResult.data ?? {}; 
		}
		if (actionResult.type === 'failure') {
			return actionResult.data ?? {};
		}
		if (actionResult.type === 'error') {
			// ActionResult of type 'error' has an 'error' property, not 'data'
			// We typically don't pass custom data with this type, so return empty or handle specific error shape if needed
			console.error('ActionResult type error:', actionResult.error);
			return {}; 
		}
		return {}; // Should ideally not be reached if all SvelteKit action result types are handled
	};

	let currentFormActionData = $derived(getFormActionData(form));

	// State for the notes form
	let isSubmittingNote = $state(false);
	let noteFormRef: HTMLFormElement | null = $state(null);
	let newNoteText = $state('');
	// Note Editing
	let editingNoteId = $state<string | null>(null);
	let editingNoteText = $state(''); // Temporary state for the edit textarea
	let isSubmittingNoteUpdate = $state(false);
	let isSubmittingNoteDelete = $state<string | null>(null); // Track which note delete is submitting

	// Handle note form submission
	const handleNoteSubmit: SubmitFunction = () => {
		isSubmittingNote = true;
		editingNoteId = null; // Ensure not in edit mode when adding
		return async ({ update, result }) => {
			await update({ reset: false }); // update form state, prevent SvelteKit default reset
			isSubmittingNote = false;
			// Reset form if successful (check form prop)
			const latestFormActionData = getFormActionData(result); // Use result here
			if (latestFormActionData && !latestFormActionData.noteError && latestFormActionData.noteSuccess) {
				newNoteText = ''; // Clear textarea state
				noteFormRef?.reset(); // Reset native form
			}
		};
	};

	// Edit Note - Start
	function startEditingNote(note: (typeof item.item_notes)[0]) {
		editingNoteId = note.id;
		editingNoteText = note.note_text; // Populate textarea state
	}

	// Edit Note - Cancel
	function cancelEditingNote() {
		editingNoteId = null;
		editingNoteText = '';
	}

	// Update Note
	const handleNoteUpdateSubmit: SubmitFunction = () => {
		isSubmittingNoteUpdate = true;
		return async ({ update, result }) => {
			await update({ reset: false }); // update form state, prevent SvelteKit default reset
			isSubmittingNoteUpdate = false;
			// If successful, clear editing state
			const latestFormActionData = getFormActionData(result); // Use result here
			if (latestFormActionData && !latestFormActionData.noteUpdateError && latestFormActionData.noteUpdateSuccess) {
				cancelEditingNote();
			}
		};
	};

	// Delete Note
	const handleNoteDeleteSubmit: SubmitFunction = ({ submitter }) => {
		const noteId = submitter
			?.closest('form')
			?.querySelector<HTMLInputElement>('input[name="noteId"]')?.value;
		if (noteId) {
			isSubmittingNoteDelete = noteId;
		}
		return async ({ update }) => {
			await update();
			isSubmittingNoteDelete = null; // Reset loading state regardless of outcome
			// Optionally display form.noteDeleteSuccess/Error message
		};
	};

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

	{#if currentFormActionData?.message && (currentFormActionData?.itemUpdateSuccess || currentFormActionData?.itemUpdateError)}
		<div 
			class="alert {currentFormActionData?.itemUpdateSuccess ? 'alert-success' : currentFormActionData?.itemUpdateError ? 'alert-error' : ''} mb-4"
		>
			<span>{currentFormActionData.message || currentFormActionData.itemUpdateError}</span>
		</div>
	{/if}

	<!-- Item Details Card -->
	<ItemDetailsCard item={item} onEdit={() => showItemDialog = true} />

	<!-- Item Notes Section -->
	<Card.Root class="border-none shadow-none">
		<Card.Header>
			<Card.Title
				>Notes <span class="ml-1 rounded-full bg-muted p-3 py-1 text-sm font-bold"
					>{item.item_notes.length}</span
				></Card.Title
			>
			<Card.Description>Add and manage notes about this item</Card.Description>
		</Card.Header>
		<Card.Content>
			<!-- Add Note Form -->
			<form
				method="POST"
				action="?/addNote"
				use:enhance={handleNoteSubmit}
				bind:this={noteFormRef}
				class="mb-6"
			>
				{#if currentFormActionData?.noteError && editingNoteId === null}
					<!-- Only show add error if not editing -->
					<div class="alert alert-error mb-2 p-2 text-sm">
						<span>{currentFormActionData.noteError}</span>
					</div>
				{/if}
				{#if currentFormActionData?.noteSuccess}
					<div class="alert alert-success mb-2 p-2 text-sm">
						<span>{currentFormActionData.noteSuccess}</span>
					</div>
				{/if}
				<div class="form-control mb-4">
					<Textarea
						name="noteText"
						bind:value={newNoteText}
						required
						class="textarea textarea-bordered w-full"
						placeholder="Add a new note..."
						rows={3}
					></Textarea>
				</div>
				<div class="text-right">
					<Button variant="outline" type="submit" disabled={isSubmittingNote || !newNoteText.trim()}>
						{#if isSubmittingNote}
							<Loader class="animate-spin" />
						{/if}
						<CirclePlus/>
						{isSubmittingNote ? 'Adding...' : 'Add Note'}
					</Button>
				</div>
			</form>

			<!-- Notes List -->
			<div class="space-y-4 overflow-y-auto pr-2">
				{#if item.item_notes.length > 0}
					{#each item.item_notes as note (note.id)}
						<Card.Root>
							<Card.Content>
								{#if editingNoteId === note.id}
									<!-- Edit Note Form -->
									<form method="POST" action="?/updateNote" use:enhance={handleNoteUpdateSubmit}>
										<Input type="hidden" name="noteId" value={note.id} />
										{#if currentFormActionData?.noteUpdateError && currentFormActionData?.errorNoteId === note.id}
											<div class="alert alert-error mb-2 p-2 text-sm">
												<span>{currentFormActionData.noteUpdateError}</span>
											</div>
										{/if}
										<Textarea
											name="noteText"
											bind:value={editingNoteText}
											required
											class="textarea textarea-bordered mb-2 w-full text-sm"
											rows={3}
										></Textarea>
										<div class="flex items-center justify-end gap-2">
											<Button type="button" onclick={cancelEditingNote} title="Cancel Edit">
												<X />
											</Button>
											<Button
												type="submit"
												title="Save Note"
												disabled={isSubmittingNoteUpdate || !editingNoteText.trim()}
											>
												{#if isSubmittingNoteUpdate}
													<Loader class="animate-spin" />
												{:else}
													<Save />
												{/if}
											</Button>
										</div>
									</form>
								{:else}
									<!-- Display Note -->
									<div class="flex items-start justify-between gap-2">
										<div class="flex-1">
											<p class="whitespace-pre-wrap break-words text-sm">{note.note_text}</p>
											<div class="mt-1 text-xs opacity-60">
												Added {new Date(note.created_at).toLocaleString()}
												{#if note.created_at !== note.updated_at}
													(Edited {new Date(note.updated_at).toLocaleString()})
												{/if}
											</div>
										</div>
										<!-- Action Buttons (visible on hover/focus) -->
										<div
											class="flex gap-1 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
										>
											<!-- Edit Note Button -->
											<form method="POST">
												<Button
													type="button"
													variant="ghost"
													size="icon"
													onclick={() => startEditingNote(note)}
													title="Edit Note"
												>
													<PencilLine class="size-4" />
												</Button>
											</form>

											<!-- Delete Note Form -->
											<form
												method="POST"
												action="?/deleteNote"
												use:enhance={handleNoteDeleteSubmit}
												onsubmit={() => {
													if (!confirm('Are you sure you want to delete this note?')) return false;
												}}
											>
												<Input type="hidden" name="noteId" value={note.id} />
												<Button
													type="submit"
													variant="ghost"
													size="icon"
													title="Delete Note"
													disabled={isSubmittingNoteDelete === note.id}
												>
													{#if isSubmittingNoteDelete === note.id}
														<Loader class="size-4 animate-spin" />
													{:else}
														<Trash2 class="size-4" />
													{/if}
												</Button>
											</form>
										</div>
									</div>
								{/if}
							</Card.Content>
						</Card.Root>
					{/each}
				{:else}
					<div class="text-center opacity-70">
						<p>No notes yet. Add a note to keep track of important details.</p>
					</div>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>
</div>
