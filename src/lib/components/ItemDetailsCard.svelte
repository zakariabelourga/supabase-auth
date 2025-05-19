<script lang="ts">
	import type { ItemDetail } from '$lib/types'; // Adjust path as needed
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import PencilLine from '@lucide/svelte/icons/pencil-line';
	import CalendarIcon from '@lucide/svelte/icons/calendar'; // Aliased to avoid conflict
	import TagIcon from '@lucide/svelte/icons/tag'; // Aliased to avoid conflict
	import StoreIcon from '@lucide/svelte/icons/store'; // Aliased

	interface Props {
		item: ItemDetail;
		onEdit: () => void;
	}

	let { item, onEdit }: Props = $props();

	// Format date for display
	function formatDate(dateString: string): string {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString();
	}

	// Get entity display name
	function getEntityDisplayName(): string {
		return item.entity?.name ?? item.entity_name_manual ?? 'None';
	}
</script>

<Card.Root class="mb-6">
	<Card.Header>
		<div class="flex flex-row items-center justify-between space-y-0 pb-2">
			<div>
				<Card.Title class="text-2xl font-bold mb-1">{item.name}</Card.Title>
				<Card.Description>{item.description || 'No description provided'}</Card.Description>
			</div>
			<Button variant="outline" onclick={onEdit} class="flex items-center gap-2">
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
					<CalendarIcon class="mt-1 size-5 text-muted-foreground" />
					<div>
						<h3 class="font-semibold">Expiration Date</h3>
						<p>{formatDate(item.expiration)}</p>
					</div>
				</div>

				<!-- Category -->
				<div class="flex items-start gap-4">
					<TagIcon class="mt-1 size-5 text-muted-foreground" />
					<div>
						<h3 class="font-semibold">Category</h3>
						<p>{item.category?.name ?? 'Uncategorized'}</p>
					</div>
				</div>

				<!-- Provider/Entity -->
				<div class="flex items-start gap-4">
					<StoreIcon class="mt-1 size-5 text-muted-foreground" />
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
					<TagIcon class="mt-1 size-5 text-muted-foreground" />
					<div>
						<h3 class="font-semibold">Tags</h3>
						<div class="mt-1 flex flex-wrap gap-2">
							{#if item.tags && item.tags.length > 0}
								{#each item.tags as tagItem}
									<Badge variant="default">{tagItem.name}</Badge>
								{/each}
							{:else}
								<p>No tags</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Created/Updated dates -->
				<div class="flex items-start gap-4">
					<CalendarIcon class="mt-1 size-5 text-muted-foreground" />
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