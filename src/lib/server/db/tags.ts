// src/lib/server/db/tags.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tag } from '$lib/types';

/**
 * Finds existing tags or creates new ones for a given team.
 *
 * @param supabase The Supabase client instance.
 * @param teamId The ID of the team.
 * @param creatorUserId The ID of the user creating the tags (for user_id field).
 * @param tagNames An array of tag names to find or create.
 * @returns A promise that resolves to an array of tag IDs.
 * @throws Throws an error if fetching or inserting tags fails.
 */
export async function findOrCreateTagsForTeam(
    supabase: SupabaseClient,
    teamId: string,
    creatorUserId: string,
    tagNames: string[]
): Promise<string[]> {
    if (tagNames.length === 0) {
        return [];
    }

    // Normalize input tag names for consistent processing
    const normalizedTagNames = Array.from(new Set(tagNames.map(name => name.toLowerCase().trim()))).filter(name => name.length > 0);
    if (normalizedTagNames.length === 0) {
        return [];
    }

    // Find existing tags for the team using normalized names
    const { data: existingTags, error: existingTagsError } = await supabase
        .from('tags')
        .select('id, name') 
        .eq('team_id', teamId) 
        .in('name', normalizedTagNames);

    if (existingTagsError) {
        console.error('Error fetching existing tags:', existingTagsError);
        throw existingTagsError;
    }

    const existingTagMap = new Map(existingTags.map((tag) => [tag.name, tag.id]));
    let allTagIds = existingTags.map((tag) => tag.id);

    // Identify and insert new tags (names are already normalized)
    const newTagsToCreate = normalizedTagNames.filter((name) => !existingTagMap.has(name));
    if (newTagsToCreate.length > 0) {
        const { data: insertedTags, error: insertTagsError } = await supabase
            .from('tags')
            .insert(newTagsToCreate.map((name) => ({ name, team_id: teamId, user_id: creatorUserId }))) 
            .select('id');

        if (insertTagsError) {
            console.error('Error inserting new tags:', insertTagsError);
            throw insertTagsError;
        }
        allTagIds = allTagIds.concat(insertedTags.map((tag) => tag.id));
    }

    return allTagIds;
}

/**
 * Links a list of tags to a specific item.
 *
 * @param supabase The Supabase client instance.
 * @param itemId The ID of the item.
 * @param tagIds An array of tag IDs to link to the item.
 * @returns A promise that resolves when linking is complete.
 * @throws Throws an error if linking tags fails.
 */
export async function linkTagsToItem(
    supabase: SupabaseClient,
    itemId: string,
    tagIds: string[]
): Promise<void> {
    if (tagIds.length === 0) {
        return;
    }

    const { error: itemTagsError } = await supabase
        .from('item_tags')
        .insert(tagIds.map((tagId) => ({ item_id: itemId, tag_id: tagId })));

    if (itemTagsError) {
        console.error(`Error linking tags to item ${itemId}:`, itemTagsError);
        throw itemTagsError;
    }
}

/**
 * Unlinks specified tags from an item. If no tagIds are provided, unlinks all tags from the item.
 *
 * @param supabase The Supabase client instance.
 * @param itemId The ID of the item.
 * @param tagIds An optional array of specific tag IDs to unlink. If empty or undefined, all tags are unlinked.
 * @returns A promise that resolves when unlinking is complete.
 * @throws Throws an error if unlinking tags fails.
 */
export async function unlinkTagsFromItem(
    supabase: SupabaseClient,
    itemId: string,
    tagIds?: string[]
): Promise<void> {
    let query = supabase.from('item_tags').delete().eq('item_id', itemId);

    if (tagIds && tagIds.length > 0) {
        query = query.in('tag_id', tagIds);
    }
    // If tagIds is empty or undefined, the query will delete all item_tags for the itemId.

    const { error: unlinkError } = await query;

    if (unlinkError) {
        console.error(`Error unlinking tags from item ${itemId}:`, unlinkError);
        throw unlinkError;
    }
}

/**
 * Synchronizes tags for an item within a team. It ensures that the item is associated only with the given new tag names.
 * This involves finding/creating tags (scoped to the team), linking new ones, and unlinking obsolete ones.
 *
 * @param supabase The Supabase client instance.
 * @param itemId The ID of the item.
 * @param teamId The ID of the team that owns the item and tags.
 * @param modifierUserId The ID of the user performing the modification (for creating new tags).
 * @param newTagNamesFromInput An array of tag names that should be associated with the item.
 * @returns A promise that resolves when synchronization is complete.
 * @throws Throws an error if any step of tag synchronization fails.
 */
export async function syncItemTags(
    supabase: SupabaseClient,
    itemId: string,
    teamId: string, 
    modifierUserId: string, 
    newTagNamesFromInput: string[]
): Promise<void> {
    // 1. Normalize the input newTagNames to a consistent format and ensure uniqueness.
    const normalizedDesiredTagNames = Array.from(
        new Set(newTagNamesFromInput.map(name => name.toLowerCase().trim()).filter(name => name.length > 0))
    );

    // 2. Get current tags associated with the item (ID and original name).
    // The name fetched here is the one stored in the 'tags' table.
    const { data: currentItemTagRelations, error: currentTagsError } = await supabase
        .from('item_tags')
        .select('tags (id, name, team_id)') 
        .eq('item_id', itemId);

    if (currentTagsError) {
        console.error(`Error fetching current tags for item ${itemId}:`, currentTagsError);
        throw currentTagsError;
    }

    const currentTags: Tag[] = (currentItemTagRelations || [])
        .flatMap(itemRelation => {
            const relatedTags = itemRelation.tags;
            if (Array.isArray(relatedTags)) {
                return relatedTags;
            } else if (relatedTags) {
                return [relatedTags]; 
            }
            return []; 
        })
        .filter(tag => tag && typeof tag.id === 'string' && typeof tag.name === 'string');

    // Normalize current tag names for comparison. Assumes tag.name from DB is the canonical (possibly normalized) form.
    const normalizedCurrentTagNames = currentTags.map(tag => tag.name.toLowerCase().trim());

    // 3. Determine tags to unlink:
    // Tags currently linked whose normalized names are NOT in the set of normalizedDesiredTagNames.
    const tagsToUnlinkIds = currentTags
        .filter(tag => !normalizedDesiredTagNames.includes(tag.name.toLowerCase().trim()))
        .map(tag => tag.id);

    if (tagsToUnlinkIds.length > 0) {
        await unlinkTagsFromItem(supabase, itemId, tagsToUnlinkIds);
    }

    // 4. Determine tags to link:
    // Tags from normalizedDesiredTagNames whose normalized names are NOT in normalizedCurrentTagNames.
    const tagNamesToFindOrCreateAndLink = normalizedDesiredTagNames.filter(
        name => !normalizedCurrentTagNames.includes(name) 
    );
    if (tagNamesToFindOrCreateAndLink.length > 0) {
        const tagIdsToLink = await findOrCreateTagsForTeam(supabase, teamId, modifierUserId, tagNamesToFindOrCreateAndLink);
        if (tagIdsToLink.length > 0) {
            await linkTagsToItem(supabase, itemId, tagIdsToLink);
        }
    }
}