<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	let { data, form } = $props<{ data: PageData; form: ActionData | undefined }>();

	$effect(() => {
		if (form?.success && form.message) {
			toast.success(form.message);
			invalidateAll(); // Refresh data to update the list
		} else if (form?.error) {
			toast.error(form.error);
			// Optionally invalidateAll() here too if errors might change state
		}
	});
</script>

<div class="container mx-auto p-4">
	<h1 class="text-2xl font-semibold mb-6">Your Pending Invitations</h1>

	{#if data.pendingInvitations && data.pendingInvitations.length > 0}
		<ul class="space-y-4">
			{#each data.pendingInvitations as invitation}
				<li class="p-4 border rounded-lg shadow-sm bg-white">
					<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center">
						<div>
							<p class="text-lg">
								You have been invited to join the team
								<span class="font-semibold">{invitation.teamName || 'Unnamed Team'}</span>
								as a <span class="font-semibold">{invitation.role}</span>.
							</p>
							<p class="text-sm text-gray-500">
								Invited on: {new Date(invitation.createdAt).toLocaleDateString()}
							</p>
						</div>
						<div class="flex space-x-2 mt-3 sm:mt-0">
							<form
								method="POST"
								action="?/acceptInvitation"
								use:enhance={() => {
									return async ({ update }) => {
										update({ reset: false });
										// The $effect now handles toasts and invalidateAll
									};
								}}
							>
								<input type="hidden" name="invitationId" value={invitation.id} />
								<button
									type="submit"
									class="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition duration-150"
								>
									Accept
								</button>
							</form>
							<form
								method="POST"
								action="?/declineInvitation"
								use:enhance={() => {
									return async ({ update }) => {
										update({ reset: false });
										// The $effect now handles toasts and invalidateAll
									};
								}}
							>
								<input type="hidden" name="invitationId" value={invitation.id} />
								<button
									type="submit"
									class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-150"
								>
									Decline
								</button>
							</form>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-gray-600">You have no pending invitations.</p>
	{/if}
</div>

<style lang="postcss">
	/* Basic styling, can be expanded or use Tailwind utility classes directly */
	.container {
		max-width: 800px;
	}
</style>
