<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { WithElementRef } from "bits-ui";
	import type { HTMLAttributes } from "svelte/elements";
	import { useSidebar } from "./context.svelte.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLUListElement>, HTMLUListElement> = $props();

	const sidebar = useSidebar();
</script>

<ul
	bind:this={ref}
	data-sidebar="menu"
	class={cn(
		"flex w-full min-w-0 flex-col",
		sidebar.isMobile || sidebar.state !== "collapsed" ? "gap-1" : "gap-[4px]",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</ul>
