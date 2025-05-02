<script lang="ts">
    import { enhance } from '$app/forms';
    import { type SubmitFunction } from '@sveltejs/kit';
    import ItemForm from '$lib/components/ItemForm.svelte'; // Import the form component
    import Trash2 from '@lucide/svelte/icons/trash-2'; // Icon for delete
    import PencilLine from '@lucide/svelte/icons/pencil-line'; // Icon for edit
    import Save from '@lucide/svelte/icons/save'; // Icon for save
    import X from '@lucide/svelte/icons/x'; // Icon for cancel

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
    function startEditingNote(note: typeof item.item_notes[0]) {
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
    const handleNoteDeleteSubmit: SubmitFunction = ( { submitter }) => {
        const noteId = submitter?.closest('form')?.querySelector<HTMLInputElement>('input[name="noteId"]')?.value;
        if (noteId) {
             isSubmittingNoteDelete = noteId;
        }
        return async ({ update }) => {
            await update();
            isSubmittingNoteDelete = null; // Reset loading state regardless of outcome
            // Optionally display form.noteDeleteSuccess/Error message
        };
    };

    // Handle item form state (closing on success)
    let showItemForm = $state(true); // Keep item form open by default on this page
    $effect(() => {
        // Close item form only on successful item update (not note add)
        if ((form?.status === 200 || form?.status === 201) && !(form as any)?.values && !(form as any)?.noteSuccess && !(form as any)?.noteError && !(form as any)?.noteUpdateSuccess && !(form as any)?.noteUpdateError && !(form as any)?.noteDeleteSuccess && !(form as any)?.noteDeleteError) { 
            // Item form succeeded
        } 
    });

    // Scroll to the bottom of notes list when a new note is added
    let notesListElement: HTMLElement | null = $state(null);
    $effect(() => {
        // This effect runs whenever item.item_notes changes
        if (notesListElement && item.item_notes.length > 0) {
            // Check if the scroll position is near the bottom before auto-scrolling
            // (prevents scrolling if user manually scrolled up)
            const threshold = 50; // Pixels from bottom
            const isScrolledToBottom = notesListElement.scrollHeight - notesListElement.scrollTop - notesListElement.clientHeight < threshold;
            
            // Simple approach: always scroll down when notes change
            // A more sophisticated approach might only scroll if the user was already near the bottom
            notesListElement.scrollTo({ top: notesListElement.scrollHeight, behavior: 'smooth' });
        }
        // To track count changes specifically like afterUpdate, you'd need more state
        // let previousNoteCount = $state(item.item_notes.length);
        // if (item.item_notes.length > previousNoteCount) { ... }
        // previousNoteCount = item.item_notes.length;
        // But simply scrolling on any change is often sufficient
    });

</script>

<svelte:head>
    <title>Item: {item.name}</title>
</svelte:head>

<div class="container mx-auto p-4 md:p-8">
    <a href="/app/items" class="btn btn-ghost mb-6">&larr; Back to Items</a>

    <h1 class="text-3xl font-bold mb-6">Item Details</h1>

    <!-- Item Edit Form -->
    {#if showItemForm}
        <ItemForm 
            item={item} 
            categories={categories} 
            entities={entities} 
            formResult={form as any}
        />
        <div class="text-right mb-6">
            <!-- <button class="btn btn-ghost" onclick={() => showItemForm = false}>Hide Details</button> -->
        </div>
    {/if}

    <!-- Item Notes Section -->
    <div class="card bg-base-100 shadow-xl mt-8">
        <div class="card-body">
            <h2 class="card-title mb-4">Notes ({item.item_notes.length})</h2>

            <!-- Add Note Form -->
            <form 
                method="POST" 
                action="?/addNote" 
                use:enhance={handleNoteSubmit} 
                bind:this={noteFormRef}
                class="mb-6"
            >
                {#if (form as any)?.noteError && editingNoteId === null} <!-- Only show add error if not editing -->
                    <div class="alert alert-error mb-2 text-sm p-2">
                        <span>{(form as any).noteError}</span>
                    </div>
                {/if}
                {#if (form as any)?.noteSuccess}
                    <div class="alert alert-success mb-2 text-sm p-2">
                        <span>{(form as any).noteSuccess}</span>
                    </div>
                {/if}
                <div class="form-control mb-2">
                    <textarea 
                        name="noteText" 
                        bind:value={newNoteText} 
                        required 
                        class="textarea textarea-bordered w-full" 
                        placeholder="Add a new note..."
                        rows={3}
                    ></textarea>
                </div>
                <div class="text-right">
                    <button type="submit" class="btn btn-secondary btn-sm" disabled={isSubmittingNote || !newNoteText.trim()}>
                        {#if isSubmittingNote} <span class="loading loading-spinner loading-xs"></span> {/if}
                        {isSubmittingNote ? 'Adding...' : 'Add Note'}
                    </button>
                </div>
            </form>

            <!-- Notes List -->
            <div class="max-h-96 overflow-y-auto space-y-4 pr-2" bind:this={notesListElement}>
                {#if item.item_notes.length > 0}
                    {#each item.item_notes as note (note.id)}
                        <div class="p-3 rounded-lg bg-base-200 hover:bg-base-300 group">
                            {#if editingNoteId === note.id}
                                <!-- Edit Note Form -->
                                <form method="POST" action="?/updateNote" use:enhance={handleNoteUpdateSubmit}>
                                    <input type="hidden" name="noteId" value={note.id} />
                                    {#if (form as any)?.noteUpdateError && (form as any)?.errorNoteId === note.id}
                                        <div class="alert alert-error mb-2 text-sm p-2">
                                            <span>{(form as any).noteUpdateError}</span>
                                        </div>
                                    {/if}
                                    <textarea 
                                        name="noteText" 
                                        bind:value={editingNoteText} 
                                        required 
                                        class="textarea textarea-bordered w-full text-sm mb-2" 
                                        rows={3}
                                    ></textarea>
                                    <div class="flex justify-end items-center gap-2">
                                        <button 
                                            type="button" 
                                            onclick={cancelEditingNote} 
                                            class="btn btn-xs btn-ghost text-neutral-content"
                                            title="Cancel Edit"
                                        >
                                             <X class="w-3 h-3"/>
                                        </button>
                                        <button 
                                            type="submit" 
                                            class="btn btn-xs btn-success text-success-content"
                                            title="Save Note"
                                            disabled={isSubmittingNoteUpdate || !editingNoteText.trim()}
                                        >
                                            {#if isSubmittingNoteUpdate} 
                                                <span class="loading loading-spinner loading-xs"></span> 
                                            {:else}
                                                <Save class="w-3 h-3"/>
                                            {/if}
                                        </button>
                                    </div>
                                </form>
                            {:else}
                                <!-- Display Note -->
                                <div class="flex justify-between items-start gap-2">
                                    <div class="flex-1">
                                        <p class="text-sm break-words whitespace-pre-wrap">{note.note_text}</p>
                                        <div class="text-xs opacity-60 mt-1">
                                            Added {new Date(note.created_at).toLocaleString()}
                                            {#if note.created_at !== note.updated_at} 
                                                (Edited {new Date(note.updated_at).toLocaleString()})
                                            {/if}
                                        </div>
                                    </div>
                                    <!-- Action Buttons (visible on hover/focus) -->
                                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                        <button 
                                            class="btn btn-xs btn-ghost text-info" 
                                            onclick={() => startEditingNote(note)} 
                                            title="Edit Note"
                                            disabled={editingNoteId !== null}
                                        > <!-- Disable if another edit is active -->
                                            <PencilLine class="w-3 h-3"/>
                                        </button>
                                        <form 
                                            method="POST" 
                                            action="?/deleteNote" 
                                            use:enhance={handleNoteDeleteSubmit}
                                            class="inline-block" 
                                            onsubmit={() => confirm('Are you sure you want to delete this note?')}
                                        >
                                            <input type="hidden" name="noteId" value={note.id} />
                                            <button 
                                                type="submit" 
                                                class="btn btn-xs btn-ghost text-error" 
                                                title="Delete Note"
                                                disabled={editingNoteId !== null || isSubmittingNoteDelete === note.id}
                                            > <!-- Disable if editing or this delete is submitting -->
                                                {#if isSubmittingNoteDelete === note.id}
                                                    <span class="loading loading-spinner loading-xs"></span>
                                                {:else}
                                                    <Trash2 class="w-3 h-3"/>
                                                {/if}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/each}
                {:else}
                    <p class="text-center text-gray-500 italic">No notes added yet.</p>
                {/if}
            </div>
        </div>
    </div>

</div> 