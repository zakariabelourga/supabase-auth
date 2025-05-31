<script lang="ts">
	import type { Snippet } from "svelte";
	let { title, children } : {title : string; children?: Snippet } = $props();
</script>

<div class="mb-6 flex items-center justify-between">
	<h3 class="scroll-m-10 text-2xl font-semibold tracking-tight">{title}</h3>
	{@render children?.()}
</div>
