<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, count, children }: { title: string; count?: Number; children?: Snippet } = $props();
</script>

<div class="mb-6 flex items-center justify-between">
	<div class="flex items-center gap-4">
		<h3 class="scroll-m-10 text-2xl font-semibold tracking-tight">{title}</h3>
	<div class="text-muted-foreground text-lg font-medium items-center">{count}</div>
	</div>
	{@render children?.()}
</div>
