<script lang="ts">
    import { enhance } from '$app/forms';
    import { type SubmitFunction } from '@sveltejs/kit';
    import ItemForm from '$lib/components/ItemForm.svelte'; // Import the form component

    let { data, form } = $props(); // Receive loaded data and form action results
    let { item, categories, entities } = $derived(data);

    // State for the notes form
    let isSubmittingNote = $state(false);
    let noteFormRef: HTMLFormElement | null = $state(null);
    let newNoteText = $state('');

    // Handle note form submission
    const handleNoteSubmit: SubmitFunction = () => {
        isSubmittingNote = true;
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

    // Handle item form state (closing on success)
    let showItemForm = $state(true); // Keep item form open by default on this page
    $effect(() => {
        // Close item form only on successful item update (not note add)
        if ((form?.status === 200 || form?.status === 201) && !(form as any)?.values && !(form as any)?.noteSuccess && !(form as any)?.noteError) { 
           // It was an item update/add success (though add shouldn't happen here)
           // Decide if you want to close the form or just show success
           // For now, keep it open but show success via ItemForm's internal logic
           // showItemForm = false; // Optional: close form on success
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
                {#if (form as any)?.noteError}
                    <div class="alert alert-error mb-4">
                        <span>{(form as any).noteError}</span>
                    </div>
                {/if}
                 {#if (form as any)?.noteSuccess}
                    <div class="alert alert-success mb-4">
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
            <div class="max-h-96 overflow-y-auto space-y-4" bind:this={notesListElement}>
                {#if item.item_notes.length > 0}
                    {#each item.item_notes as note (note.id)}
                        <div class="chat chat-start">
                            <div class="chat-header text-xs opacity-50 px-1">
                                Added {new Date(note.created_at).toLocaleString()}
                                {#if note.created_at !== note.updated_at} 
                                    (Edited {new Date(note.updated_at).toLocaleString()})
                                {/if}
                                <!-- TODO: Add user info if needed -->
                            </div>
                            <div class="chat-bubble chat-bubble-info break-words">
                                {note.note_text}
                                <!-- TODO: Add Edit/Delete buttons for notes -->
                            </div>
                            
                        </div>
                    {/each}
                {:else}
                    <p class="text-center text-gray-500 italic">No notes added yet.</p>
                {/if}
            </div>
        </div>
    </div>

</div> 