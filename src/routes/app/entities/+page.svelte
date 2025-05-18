<script lang="ts">
    import { enhance } from '$app/forms';
    import { type SubmitFunction } from '@sveltejs/kit';
    import type { Entity } from '$lib/types';

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
            const isExplicitSuccess = form?.status && (form.status === 201 || form.status === 200) && !(form as any)?.values;
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

<div class="container mx-auto p-4 md:p-8">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">My Providers / Entities</h1>
        <button 
            onclick={() => { 
                editingEntity = null; // Ensure add mode
                showForm = !showForm; 
            }}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={showForm && isEditMode} 
        > <!-- Disable add while editing -->
            {showForm && !isEditMode ? 'Cancel' : '+ Add New Entity'}
        </button>
    </div>

    <!-- Add/Edit Entity Form -->
    {#if showForm}
        <div class="bg-white rounded-lg shadow-lg mb-6 overflow-hidden">
            <div class="p-6">
                <h2 class="text-xl font-semibold mb-4">{isEditMode ? 'Edit Entity' : 'Add New Entity'}</h2>
                <form 
                    method="POST" 
                    action={isEditMode ? '?/updateEntity' : '?/addEntity'} 
                    use:enhance={handleSubmit}
                    bind:this={formRef}
                > 
                    {#if form?.message && ( (form as any).values?.entityId === editingEntity?.id || !(form as any).values?.isUpdate )}
                        <div class={`p-4 mb-4 rounded-md ${form.status && form.status < 400 ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                            <span>{form.message}</span>
                        </div>
                    {/if}

                    <!-- Hidden input for ID in edit mode -->
                    {#if isEditMode}
                        <input type="hidden" name="entityId" value={editingEntity?.id} />
                    {/if}

                    <div class="mb-4">
                        <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
                            Entity Name*
                        </label>
                        <input 
                            id="name" 
                            name="name" 
                            type="text" 
                            required 
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                            value={isEditMode ? (form as any)?.values?.name ?? editingEntity?.name ?? '' : (form as any)?.values?.name ?? ''}
                        />
                    </div>

                    <div class="mb-4">
                        <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea 
                            id="description" 
                            name="description" 
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                            value={isEditMode ? (form as any)?.values?.description ?? editingEntity?.description ?? '' : (form as any)?.values?.description ?? ''}
                        ></textarea>
                    </div>

                    <div class="flex justify-end space-x-2">
                        <button type="button" onclick={cancelForm} class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSubmitting}>
                            {#if isSubmitting} <span class="inline-block animate-spin mr-2">⟳</span> {/if}
                            {isSubmitting ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Entity' : 'Add Entity')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    {/if}

    <!-- Entities List -->
    {#if entities.length > 0}
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    {#each entities as entity, i (entity.id)}
                        <tr class={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td class="px-6 py-4 whitespace-nowrap">{entity.name}</td>
                            <td class="px-6 py-4 whitespace-nowrap">{entity.description ?? '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">{new Date(entity.created_at).toLocaleDateString()}</td>
                            <td class="px-6 py-4 whitespace-nowrap space-x-2">
                                <button 
                                    class="text-sm px-2 py-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed" 
                                    onclick={() => startEditing(entity)}
                                    disabled={showForm} 
                                > <!-- Disable edit while form is open-->
                                    Edit
                                </button>
                                <!-- Delete Form -->
                                <form 
                                    method="POST" 
                                    action="?/deleteEntity" 
                                    use:enhance 
                                    class="inline" 
                                    onsubmit={() => { 
                                        if (!confirm('Are you sure you want to delete this entity? Items using it will be unlinked.')) {
                                            return false; // Prevent form submission if user cancels
                                        }
                                        // Allow submission if confirmed (implicitly returns true/undefined)
                                    }}
                                >
                                    <input type="hidden" name="entityId" value={entity.id} />
                                    <button 
                                        type="submit" 
                                        class="text-sm px-2 py-1 text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={showForm} 
                                    > <!-- Disable delete while form is open-->
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
            You haven't created any entities yet.
        </p>
    {/if}
</div>