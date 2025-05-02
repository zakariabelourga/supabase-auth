<script lang="ts">
    import { enhance } from '$app/forms';
    import { type SubmitFunction } from '@sveltejs/kit';
    import type { ActionResult } from '@sveltejs/kit';

    // --- Component Props ---
    type Category = { id: string; name: string };
    type Entity = { id: string; name: string; description: string | null };
    type ItemTag = { id: string; name: string };
    type Item = {
        id: string;
        name: string;
        description: string | null;
        expiration: string; 
        category: { id: string; name: string } | null;
        tags: ItemTag[];
        entity: { id: string; name: string } | null; 
        entity_name_manual: string | null; 
    } | null;

    // Define a type for the expected form result structure (can be more specific)
    type ItemFormResult = ActionResult & { 
        message?: string; 
        values?: any; 
        status?: number;
        itemUpdatedButTagsFailed?: boolean;
        isUpdate?: boolean; // Flag from update action
    };

    let { 
        item = $bindable(null),
        categories = [] as Category[], // Use plain default array
        entities = [] as Entity[],   // Use plain default array
        formResult = $bindable(null as ItemFormResult | null | undefined) // Bindable prop for parent's $form
    }: { 
        item?: Item | null, 
        categories?: Category[], 
        entities?: Entity[],
        formResult?: ItemFormResult | null | undefined
    } = $props();

    // --- Internal Component State ---
    let isSubmitting = $state(false);
    let formRef: HTMLFormElement | null = $state(null);
    let isEditMode = $derived(!!item); // Derived state internal to component

    // --- Helper Functions ---
    function formatTagsForInput(tags: ItemTag[] | undefined | null): string {
        if (!tags) return '';
        return tags.map(t => t.name).join(', ');
    }
    function getEntityInputValue(currentItem: Item | null): string {
        if (!currentItem) return '';
        return currentItem.entity?.name ?? currentItem.entity_name_manual ?? '';
    }
    function formatDateForInput(dateString: string | null | undefined): string {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            console.error("Error formatting date:", e);
            return '';
        }
    }

    // --- Form Submission Handling ---
    const handleSubmit: SubmitFunction = () => {
        isSubmitting = true;
        return async ({ result, update }) => {
            // Wait for SvelteKit to process the action result and update $form
            await update(); 
            // Now that the update is done, explicitly reset the submitting state
            isSubmitting = false; 
            // Parent page handles closing the form via its $effect
        };
    };

    // Reactive derived state for form values from the parent's $form prop
    let formValues = $derived(formResult?.values);

</script>

<!-- Add/Edit Item Form Component -->
<div class="card bg-base-200 shadow-xl mb-6">
    <div class="card-body">
        <h2 class="card-title mb-4">{isEditMode ? 'Edit Item' : 'Add New Item'}</h2>
        <form 
            method="POST" 
            action={isEditMode ? '?/updateItem' : '?/addItem'}
            use:enhance={handleSubmit} 
            bind:this={formRef}
        > <!-- Action determined by parent page context -->
            <!-- Display Message from Parent ($form / formResult prop) -->
            {#if formResult?.message && ( (formValues?.itemId === item?.id && isEditMode) || (!isEditMode && !formValues?.isUpdate) || (formValues?.isUpdate === isEditMode) )}
                <div 
                    class={`alert ${ (formResult.status && formResult.status < 400) || formResult.itemUpdatedButTagsFailed ? 'alert-success' : 'alert-error'} mb-4`}
                >
                    <span>{formResult.message}</span>
                </div>
            {/if}

            <!-- Hidden input for ID in edit mode -->
            {#if isEditMode}
                <input type="hidden" name="itemId" value={item?.id} />
            {/if}

            <!-- Item Name -->
            <div class="form-control mb-4">
                <label for="name" class="label"><span class="label-text">Item Name*</span></label>
                <input 
                    id="name" 
                    name="name" 
                    type="text" 
                    required 
                    class="input input-bordered w-full" 
                    value={formValues?.name ?? (isEditMode ? item?.name : '') ?? ''} 
                />
            </div>

            <!-- Description -->
            <div class="form-control mb-4">
                <label for="description" class="label"><span class="label-text">Description</span></label>
                <textarea 
                    id="description" 
                    name="description" 
                    class="textarea textarea-bordered w-full" 
                    value={formValues?.description ?? (isEditMode ? item?.description : '') ?? ''}
                ></textarea>
            </div>

            <!-- Category -->
            <div class="form-control mb-4">
                <label for="categoryId" class="label"><span class="label-text">Category</span></label>
                <select 
                    id="categoryId" 
                    name="categoryId" 
                    class="select select-bordered w-full" 
                    value={formValues?.categoryId ?? (isEditMode ? item?.category?.id : '') ?? ''}
                >
                    <option value="" selected={!(formValues?.categoryId ?? (isEditMode ? item?.category?.id : null))}>
                        Select a category
                    </option>
                    {#each categories as category}
                        <option value={category.id}>{category.name}</option>
                    {/each}
                </select>
            </div>

            <!-- Entity Input with Datalist -->
            <div class="form-control mb-4">
                <label for="entityNameManual" class="label"><span class="label-text">Provider / Entity</span></label>
                <input 
                    id="entityNameManual"
                    name="entityNameManual"
                    type="text" 
                    class="input input-bordered w-full"
                    list="entities-list" 
                    placeholder="Type or select an entity"
                    value={formValues?.entityNameManual ?? (isEditMode ? getEntityInputValue(item) : '') ?? ''}
                />
                <datalist id="entities-list">
                    {#each entities as entity}
                        <option value={entity.name}>{entity.description ? `${entity.name} (${entity.description})` : entity.name}</option>
                    {/each}
                </datalist>
            </div>

            <!-- Tags -->
            <div class="form-control mb-4">
                <label for="tags" class="label"><span class="label-text">Tags (comma-separated)</span></label>
                <input 
                    id="tags" 
                    name="tags" 
                    type="text" 
                    class="input input-bordered w-full" 
                    value={formValues?.tagsString ?? (isEditMode ? formatTagsForInput(item?.tags) : '') ?? ''}
                />
            </div>

            <!-- Expiration Date -->
            <div class="form-control mb-4">
                <label for="expiration" class="label"><span class="label-text">Expiration Date*</span></label>
                <input 
                    id="expiration" 
                    name="expiration" 
                    type="date" 
                    required 
                    class="input input-bordered w-full" 
                    value={formValues?.expiration ?? (isEditMode ? formatDateForInput(item?.expiration) : '') ?? ''}
                />
            </div>

            <div class="card-actions justify-end">
                <!-- Cancel button is handled by the parent page -->
                <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
                    {#if isSubmitting} <span class="loading loading-spinner"></span> {/if}
                    {isSubmitting ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Item' : 'Add Item')}
                </button>
            </div>
        </form>
    </div>
</div> 