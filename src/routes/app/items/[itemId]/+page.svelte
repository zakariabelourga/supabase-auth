<script lang="ts">
	import { enhance } from '$app/forms';
	import { type SubmitFunction } from '@sveltejs/kit';
	import ItemForm from '$lib/components/ItemForm.svelte'; // Import the form component
	import Trash2 from '@lucide/svelte/icons/trash-2'; // Icon for delete
	import PencilLine from '@lucide/svelte/icons/pencil-line'; // Icon for edit
	import Save from '@lucide/svelte/icons/save'; // Icon for save
	import X from '@lucide/svelte/icons/x'; // Icon for cancel
	import Loader from '@lucide/svelte/icons/loader';
	import Calendar from '@lucide/svelte/icons/calendar'; // Icon for expiration date
	import Tag from '@lucide/svelte/icons/tag'; // Icon for tags
	import Store from '@lucide/svelte/icons/store'; // Icon for entity/provider
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	let { data, form } = $props(); // Receive loaded data and form action results
	let { item, categories, entities } = $derived(data);

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
		return async ({ update }) => {
			await update(); // Important: update form state
			isSubmittingNote = false;
			// Reset form if successful (check form prop)
			if (form && !(form as any).noteError) {
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
		return async ({ update }) => {
			await update();
			isSubmittingNoteUpdate = false;
			// If successful, clear editing state
			if (form && !(form as any).noteUpdateError && (form as any).noteUpdateSuccess) {
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

	// Handle item form state
	let showItemForm = $state(false); // Hide item form by default

	function toggleItemForm() {
		showItemForm = !showItemForm;
	}

	$effect(() => {
		// Close item form on successful item update (not note add)
		if (
			(form?.status === 200 || form?.status === 201) &&
			!(form as any)?.values &&
			!(form as any)?.noteSuccess &&
			!(form as any)?.noteError &&
			!(form as any)?.noteUpdateSuccess &&
			!(form as any)?.noteUpdateError &&
			!(form as any)?.noteDeleteSuccess &&
			!(form as any)?.noteDeleteError
		) {
			showItemForm = false; // Hide form after successful update
		}
	});

	// Format date for display
	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString();
	}

	// Get entity display name
	function getEntityDisplayName(): string {
		return item.entity?.name ?? item.entity_name_manual ?? 'None';
	}

	// Scroll to the bottom of notes list when a new note is added
	let notesListElement: HTMLElement | null = $state(null);
	$effect(() => {
		// This effect runs whenever item.item_notes changes
		if (notesListElement && item.item_notes.length > 0) {
			// Check if the scroll position is near the bottom before auto-scrolling
			// (prevents scrolling if user manually scrolled up)
			const threshold = 50; // Pixels from bottom
			const isScrolledToBottom =
				notesListElement.scrollHeight - notesListElement.scrollTop - notesListElement.clientHeight <
				threshold;

			// Simple approach: always scroll down when notes change
			// A more sophisticated approach might only scroll if the user was already near the bottom
			notesListElement.scrollTo({ top: notesListElement.scrollHeight, behavior: 'smooth' });
		}
	});
</script>

<svelte:head>
	<title>Item: {item.name}</title>
</svelte:head>

<div class="container mx-auto p-4 md:p-8">
	<a href="/app/items" class="btn btn-ghost mb-6">&larr; Back to Items</a>

	<h1 class="mb-6 text-3xl font-bold">Item Details</h1>

	{#if form?.message && !(form as any)?.noteError && !(form as any)?.noteSuccess && !(form as any)?.noteUpdateError && !(form as any)?.noteUpdateSuccess && !(form as any)?.noteDeleteError && !(form as any)?.noteDeleteSuccess}
		<div class="alert {form.status && form.status < 400 ? 'alert-success' : 'alert-error'} mb-4">
			<span>{form.message}</span>
		</div>
	{/if}

	<!-- Item Details Card -->
	{#if !showItemForm}
		<Card.Root class="mb-6">
			<Card.Header>
				<div class="flex flex-row items-center justify-between space-y-0 pb-2">
					<div>
						<Card.Title class="text-2xl font-bold mb-1">{item.name}</Card.Title>
						<Card.CardDescription>{item.description || 'No description provided'}</Card.CardDescription>
					</div>
					<Button variant="outline" onclick={toggleItemForm} class="flex items-center gap-2">
						<PencilLine class="size-4" /> Edit Item
					</Button>
				</div>
			</Card.Header>
			<Card.Content>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<!-- Left column -->
					<div class="space-y-4">
						<!-- Expiration Date -->
						<div class="flex items-start gap-4">
							<Calendar class="mt-1 size-5 text-muted-foreground" />
							<div>
								<h3 class="font-semibold">Expiration Date</h3>
								<p>{formatDate(item.expiration)}</p>
							</div>
						</div>

						<!-- Category -->
						<div class="flex items-start gap-4">
							<Tag class="mt-1 size-5 text-muted-foreground" />
							<div>
								<h3 class="font-semibold">Category</h3>
								<p>{item.category?.name ?? 'Uncategorized'}</p>
							</div>
						</div>

						<!-- Provider/Entity -->
						<div class="flex items-start gap-4">
							<Store class="mt-1 size-5 text-muted-foreground" />
							<div>
								<h3 class="font-semibold">Provider/Entity</h3>
								<p>{getEntityDisplayName()}</p>
							</div>
						</div>
					</div>

					<!-- Right column -->
					<div class="space-y-4">
						<!-- Tags -->
						<div class="flex items-start gap-4">
							<Tag class="mt-1 size-5 text-muted-foreground" />
							<div>
								<h3 class="font-semibold">Tags</h3>
								<div class="mt-1 flex flex-wrap gap-2">
									{#if item.tags && item.tags.length > 0}
										{#each item.tags as tag}
											<Badge variant="default">{tag.name}</Badge>
										{/each}
									{:else}
										<p>No tags</p>
									{/if}
								</div>
							</div>
						</div>

						<!-- Created/Updated dates -->
						<div class="flex items-start gap-4">
							<Calendar class="mt-1 size-5 text-muted-foreground" />
							<div>
								<h3 class="font-semibold">Created</h3>
								<p>{formatDate(item.created_at)}</p>
								{#if item.created_at !== item.updated_at}
									<p class="text-sm text-muted-foreground">
										Last updated: {formatDate(item.updated_at)}
									</p>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- Item Edit Form -->
		<Card.Root class="mb-6">
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title>Edit Item</Card.Title>
				<Button variant="outline" onclick={toggleItemForm} class="flex items-center gap-2">
					<X class="size-4" /> Cancel
				</Button>
			</Card.Header>
			<Card.Content>
				<ItemForm {item} {categories} {entities} formResult={form as any} />
			</Card.Content>
		</Card.Root>
	{/if}

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
				{#if (form as any)?.noteError && editingNoteId === null}
					<!-- Only show add error if not editing -->
					<div class="alert alert-error mb-2 p-2 text-sm">
						<span>{(form as any).noteError}</span>
					</div>
				{/if}
				{#if (form as any)?.noteSuccess}
					<div class="alert alert-success mb-2 p-2 text-sm">
						<span>{(form as any).noteSuccess}</span>
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
			<div class="space-y-4 overflow-y-auto pr-2" bind:this={notesListElement}>
				{#if item.item_notes.length > 0}
					{#each item.item_notes as note (note.id)}
						<Card.Root>
							<Card.Content>
								{#if editingNoteId === note.id}
									<!-- Edit Note Form -->
									<form method="POST" action="?/updateNote" use:enhance={handleNoteUpdateSubmit}>
										<Input type="hidden" name="noteId" value={note.id} />
										{#if (form as any)?.noteUpdateError && (form as any)?.errorNoteId === note.id}
											<div class="alert alert-error mb-2 p-2 text-sm">
												<span>{(form as any).noteUpdateError}</span>
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
