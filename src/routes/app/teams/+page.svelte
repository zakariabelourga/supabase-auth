<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionResult } from '@sveltejs/kit';

	export let data: PageData;
	export let form: ActionData; // To get feedback from actions

	let renamingTeamId: string | null = null;
	let invitingToTeamId: string | null = null;
	let newTeamNameInputValue: string = '';
	let inviteEmailInputValue: string = '';
	let inviteRoleValue: 'admin' | 'editor' | 'viewer' = 'editor';

	// Function to handle successful form submission for createTeam
	const handleCreateSuccess = () => {
		invalidateAll();
		const teamNameInput = document.getElementById('teamName') as HTMLInputElement;
		if (teamNameInput) teamNameInput.value = '';
		// form prop will be updated by SvelteKit, displaying success/error for createTeam
	};

	const toggleRenameForm = (teamId: string, currentName: string) => {
		if (renamingTeamId === teamId) {
			renamingTeamId = null;
		} else {
			renamingTeamId = teamId;
			invitingToTeamId = null; // Close other form
			newTeamNameInputValue = currentName; // Pre-fill with current name
		}
	};

	const toggleInviteForm = (teamId: string) => {
		if (invitingToTeamId === teamId) {
			invitingToTeamId = null;
		} else {
			invitingToTeamId = teamId;
			renamingTeamId = null; // Close other form
			inviteEmailInputValue = ''; // Reset fields
			inviteRoleValue = 'editor';
		}
	};

	const handleAdminActionSubmit = () => {
		return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
			if (result.type === 'success' && result.data?.success) {
				invalidateAll(); // Refresh data on any successful admin action

				// Reset UI states based on which action was successful
				if (result.data?.teamId) {
					if (renamingTeamId === result.data.teamId) renamingTeamId = null;
					if (invitingToTeamId === result.data.teamId) {
						invitingToTeamId = null;
						// No need to manually reset form fields if we use unique IDs for invite forms
						// and rely on Svelte's reactivity or form.reset() if applicable.
					}
				}
			}
			// SvelteKit updates the `form` prop automatically via update().
			// The template will then display form.message or form.error.
			await update();
		};
	};

	const confirmDelete = (event: Event) => {
		if (
			!window.confirm(
				'Are you sure you want to delete this team? This action cannot be undone and will remove all team members.'
			)
		) {
			event.preventDefault();
		}
	};
</script>

<svelte:head>
	<title>Your Teams</title>
</svelte:head>

<div class="container mx-auto p-4">
	<h1 class="mb-6 text-2xl font-semibold">Your Teams</h1>

	{#if data.teams && data.teams.length > 0}
		<ul class="mb-8 space-y-6">
			{#each data.teams as team (team.id)}
				<li class="rounded-lg border bg-white p-4 shadow transition-shadow hover:shadow-md">
					<div class="flex items-start justify-between">
						<div>
							<a
								href="/app/teams/{team.id}"
								class="text-lg font-medium text-indigo-600 hover:text-indigo-800"
							>
								{team.name}
							</a>
							<p class="text-sm text-gray-600">
								Your role: <span class="font-semibold">{team.currentUserRole}</span>
							</p>
						</div>
					</div>

					<!-- Admin Controls -->
					{#if team.currentUserRole === 'admin'}
						<div class="mt-4 space-y-3 border-t border-gray-200 pt-4">
							<h3 class="mb-2 text-sm font-semibold text-gray-700">Admin Actions:</h3>

							<!-- Rename Team -->
							<div>
								<button
									on:click={() => toggleRenameForm(team.id, team.name)}
									class="mr-2 text-sm text-indigo-600 hover:text-indigo-800"
								>
									Rename Team
								</button>
								{#if renamingTeamId === team.id}
									<form
										method="POST"
										action="?/renameTeam"
										use:enhance={handleAdminActionSubmit}
										class="mt-2 space-y-2 rounded-md bg-gray-50 p-3"
									>
										<input type="hidden" name="teamId" value={team.id} />
										<div>
											<label
												for={`newName-${team.id}`}
												class="block text-xs font-medium text-gray-700">New Name</label
											>
											<input
												type="text"
												name="newName"
												id={`newName-${team.id}`}
												bind:value={newTeamNameInputValue}
												class="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm sm:w-auto"
												minlength="3"
												required
											/>
										</div>
										<div>
											<button
												type="submit"
												class="rounded bg-green-500 px-2 py-1 text-xs text-white hover:bg-green-600"
												>Save</button
											>
											<button
												type="button"
												on:click={() => (renamingTeamId = null)}
												class="ml-1 rounded bg-gray-300 px-2 py-1 text-xs hover:bg-gray-400"
												>Cancel</button
											>
										</div>
									</form>
								{/if}
							</div>

							<!-- Invite User -->
							<div>
								<button
									on:click={() => toggleInviteForm(team.id)}
									class="mr-2 text-sm text-indigo-600 hover:text-indigo-800"
								>
									Invite User
								</button>
								{#if invitingToTeamId === team.id}
									<form
										method="POST"
										action="?/inviteUser"
										use:enhance={handleAdminActionSubmit}
										class="mt-2 space-y-2 rounded-md bg-gray-50 p-3"
										id={`inviteForm-${team.id}`}
									>
										<input type="hidden" name="teamId" value={team.id} />
										<div>
											<label
												for={`userEmail-${team.id}`}
												class="block text-xs font-medium text-gray-700">User Email</label
											>
											<input
												type="email"
												name="userEmail"
												id={`userEmail-${team.id}`}
												bind:value={inviteEmailInputValue}
												class="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm sm:w-auto"
												required
											/>
										</div>
										<div>
											<label for={`role-${team.id}`} class="block text-xs font-medium text-gray-700"
												>Role</label
											>
											<select
												name="role"
												id={`role-${team.id}`}
												bind:value={inviteRoleValue}
												class="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm sm:w-auto"
											>
												<option value="editor">Editor</option>
												<option value="viewer">Viewer</option>
												<option value="admin">Admin</option>
											</select>
										</div>
										<div>
											<button
												type="submit"
												class="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
												>Send Invite</button
											>
											<button
												type="button"
												on:click={() => (invitingToTeamId = null)}
												class="ml-1 rounded bg-gray-300 px-2 py-1 text-xs hover:bg-gray-400"
												>Cancel</button
											>
										</div>
									</form>
								{/if}
							</div>

							<!-- Delete Team -->
							<form
								method="POST"
								action="?/deleteTeam"
								use:enhance={handleAdminActionSubmit}
								on:submit={confirmDelete}
								class="inline"
							>
								<input type="hidden" name="teamId" value={team.id} />
								<button type="submit" class="text-sm text-red-600 hover:text-red-800">
									Delete Team
								</button>
							</form>
						</div>
					{/if}

					<!-- Feedback for admin actions related to this specific team -->
					{#if form && form.teamId === team.id}
						<div class="mt-2 text-xs">
							{#if form.success && form.message}
								<p class="text-green-600">{form.message}</p>
							{/if}
							{#if !form.success && form.message}
								<p class="text-red-600">{form.message}</p>
							{/if}
							{#if (form as any)?.error}
								<p class="text-red-600">Error: {(form as any).error}</p>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{:else if !data.teams}
		<p class="text-gray-700">Loading teams...</p>
	{:else}
		<p class="mb-8 text-gray-700">You are not a member of any teams yet. Create one below!</p>
	{/if}

	<div class="rounded-lg bg-gray-50 p-6 shadow">
		<h2 class="mb-4 text-xl font-semibold">Create New Team</h2>
		<form
			method="POST"
			action="?/createTeam"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success' && result.data?.success) {
						handleCreateSuccess();
					}
					// For other result types (failure, redirect, etc.), SvelteKit handles them by default
					// or you can add custom logic here.
					await update(); // Essential for SvelteKit to update the form prop and page data
				};
			}}
			class="space-y-4"
		>
			<div>
				<label for="teamName" class="block text-sm font-medium text-gray-700">Team Name</label>
				<input
					type="text"
					name="teamName"
					id="teamName"
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
					placeholder="My Awesome Team"
					minlength="3"
					required
					aria-describedby="teamName-error"
					value={form?.teamName || ''}
				/>
				{#if form?.error}
					<p id="teamName-error" class="mt-2 text-sm text-red-600">{form.error}</p>
				{/if}
				{#if form?.success}
					<p class="mt-2 text-sm text-green-600">Team "{form.teamName}" created successfully!</p>
				{/if}
			</div>
			<div>
				<button
					type="submit"
					class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
				>
					Create Team
				</button>
			</div>
		</form>
	</div>
</div>

<style>
	/* Basic container styling, Tailwind handles most of it */
	/* You can add more specific styles here if needed */
</style>
