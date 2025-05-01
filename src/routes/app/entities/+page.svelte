<script lang="ts">
    import { enhance } from '$app/forms';
    import { type SubmitFunction } from '@sveltejs/kit';

    // Define Entity type matching the server load
    type Entity = {
        id: string;
        name: string;
        description: string | null;
        created_at: string;
    }

    let { data, form } = $props();
    let { entities } = $derived(data);

    // State for the form (add or edit)
    let showForm = $state(false);
    let editingEntity: Entity | null = $state(null);
    let isSubmitting = $state(false);
    let formRef: HTMLFormElement | null = $state(null);

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
        // Success (Add or Update)
        if ((form?.status === 201 || form?.status === 200) && !(form as any)?.values) { 
            cancelForm(); // Close form, clear editing state
            formRef?.reset(); // Reset form fields
            // Optionally show success toast: alert(form.message);
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
    });

    const handleSubmit: SubmitFunction = () => {
        isSubmitting = true;
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
            class="btn btn-primary"
            disabled={showForm && isEditMode} 
        > <!-- Disable add while editing -->
            {showForm && !isEditMode ? 'Cancel' : '+ Add New Entity'}
        </button>
    </div>

    <!-- Add/Edit Entity Form -->
    {#if showForm}
        <div class="card bg-base-200 shadow-xl mb-6">
            <div class="card-body">
                <h2 class="card-title mb-4">{isEditMode ? 'Edit Entity' : 'Add New Entity'}</h2>
                <form 
                    method="POST" 
                    action={isEditMode ? '?/updateEntity' : '?/addEntity'} 
                    use:enhance={handleSubmit}
                    bind:this={formRef}
                > 
                    {#if form?.message && ( (form as any).values?.entityId === editingEntity?.id || !(form as any).values?.isUpdate )}
                        <div class={`alert ${form.status && form.status < 400 ? 'alert-success' : 'alert-error'} mb-4`}>
                            <span>{form.message}</span>
                        </div>
                    {/if}

                    <!-- Hidden input for ID in edit mode -->
                    {#if isEditMode}
                        <input type="hidden" name="entityId" value={editingEntity?.id} />
                    {/if}

                    <div class="form-control mb-4">
                        <label for="name" class="label">
                            <span class="label-text">Entity Name*</span>
                        </label>
                        <input 
                            id="name" 
                            name="name" 
                            type="text" 
                            required 
                            class="input input-bordered w-full" 
                            value={isEditMode ? (form as any)?.values?.name ?? editingEntity?.name ?? '' : (form as any)?.values?.name ?? ''}
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
                            value={isEditMode ? (form as any)?.values?.description ?? editingEntity?.description ?? '' : (form as any)?.values?.description ?? ''}
                        ></textarea>
                    </div>

                    <div class="card-actions justify-end">
                        <button type="button" onclick={cancelForm} class="btn btn-ghost">Cancel</button>
                        <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
                            {#if isSubmitting} <span class="loading loading-spinner"></span> {/if}
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
            <table class="table table-zebra w-full">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Created At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each entities as entity (entity.id)}
                        <tr>
                            <td>{entity.name}</td>
                            <td>{entity.description ?? '-'}</td>
                            <td>{new Date(entity.created_at).toLocaleDateString()}</td>
                            <td>
                                <button 
                                    class="btn btn-xs btn-ghost" 
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
                                    style="display: inline;" 
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
                                        class="btn btn-xs btn-ghost text-error"
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

<style>
    /* Add component-specific styles if needed */
</style> 