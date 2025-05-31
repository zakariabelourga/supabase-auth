<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/PageHeader.svelte';

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

<PageHeader title="Your Pending Invitations" count={data.pendingInvitations?.length}></PageHeader>

{#if data.pendingInvitations && data.pendingInvitations.length > 0}
	<ul class="mt-6 space-y-4">
		{#each data.pendingInvitations as invitation}
			<li class="rounded-lg border bg-white p-4 shadow-sm">
				<div class="flex flex-col items-start justify-between sm:flex-row sm:items-center">
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
					<div class="mt-3 flex space-x-2 sm:mt-0">
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
								class="rounded-md bg-green-500 px-4 py-2 text-white transition duration-150 hover:bg-green-600"
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
								class="rounded-md bg-red-500 px-4 py-2 text-white transition duration-150 hover:bg-red-600"
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
