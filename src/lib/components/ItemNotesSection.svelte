<script lang="ts">
	import { enhance } from '$app/forms';
	import { type SubmitFunction, type ActionResult } from '@sveltejs/kit';
	import type { ItemNote } from '$lib/types'; // Assuming ItemNote type is available

	import Trash2 from '@lucide/svelte/icons/trash-2';
	import PencilLine from '@lucide/svelte/icons/pencil-line';
	import Save from '@lucide/svelte/icons/save';
	import X from '@lucide/svelte/icons/x';
	import Loader from '@lucide/svelte/icons/loader';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';

	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	// Copied from +page.svelte - consider moving to a shared types file if used elsewhere
	interface ItemFormValues { // This might be needed if FormActionData depends on it heavily, or simplify if not
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
		values?: ItemFormValues; // Maintained for consistency, though less relevant for notes-only errors
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
	// End of copied types

	interface Props {
		notes: ItemNote[];
		itemId: string; // Needed for form actions to know which item the note belongs to (though actions get it from params)
		pageForm: ActionResult<Partial<FormActionData>, Partial<FormActionData>> | null;
	}

	let { notes, itemId, pageForm }: Props = $props();

	const getFormActionData = (
		actionResult: ActionResult<Partial<FormActionData>, Partial<FormActionData>> | null
	): Partial<FormActionData> | null => {
		if (!actionResult) return null;
		if (actionResult.type === 'success' || actionResult.type === 'failure') {
			return actionResult.data ?? {};
		}
		if (actionResult.type === 'error') {
			console.error('ActionResult type error in ItemNotesSection:', actionResult.error);
			return {};
		}
		return {};
	};

	let currentFormActionData = $derived(getFormActionData(pageForm));

	// State for the notes form
	let isSubmittingNote = $state(false);
	let noteFormRef: HTMLFormElement | null = $state(null);
	let newNoteText = $state('');
	// Note Editing
	let editingNoteId = $state<string | null>(null);
	let editingNoteText = $state('');
	let isSubmittingNoteUpdate = $state(false);
	let isSubmittingNoteDelete = $state<string | null>(null);

	const handleNoteSubmit: SubmitFunction = () => {
		isSubmittingNote = true;
		editingNoteId = null;
		return async ({ update, result }) => {
			await update({ reset: false });
			isSubmittingNote = false;
			const latestData = getFormActionData(result);
			if (latestData && !latestData.noteError && latestData.noteSuccess) {
				newNoteText = '';
				noteFormRef?.reset();
			}
		};
	};

	function startEditingNote(note: ItemNote) {
		editingNoteId = note.id;
		editingNoteText = note.note_text;
	}

	function cancelEditingNote() {
		editingNoteId = null;
		editingNoteText = '';
	}

	const handleNoteUpdateSubmit: SubmitFunction = () => {
		isSubmittingNoteUpdate = true;
		return async ({ update, result }) => {
			await update({ reset: false });
			isSubmittingNoteUpdate = false;
			const latestData = getFormActionData(result);
			if (latestData && !latestData.noteUpdateError && latestData.noteUpdateSuccess) {
				cancelEditingNote();
			}
		};
	};

	const handleNoteDeleteSubmit: SubmitFunction = ({ submitter }) => {
		const noteIdToDelete = submitter
			?.closest('form')
			?.querySelector<HTMLInputElement>('input[name="noteId"]')?.value;
		if (noteIdToDelete) {
			isSubmittingNoteDelete = noteIdToDelete;
		}
		return async ({ update }) => {
			await update();
			isSubmittingNoteDelete = null;
		};
	};
</script>

<Card.Root class="border-none shadow-none">
	<Card.Header>
		<Card.Title
			>Notes <span class="ml-1 rounded-full bg-muted p-3 py-1 text-sm font-bold"
				>{notes.length}</span
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
			<!-- Add a hidden input for itemId if your addNote action expects it in formData, 
			     though typically actions get route params like itemId from the event context. 
			     For now, assuming action uses params.itemId as in the provided +page.server.ts 
			<Input type="hidden" name="itemId" value={itemId} /> 
			-->
			{#if currentFormActionData?.noteError && editingNoteId === null}
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
			{#if notes.length > 0}
				{#each notes as note (note.id)}
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