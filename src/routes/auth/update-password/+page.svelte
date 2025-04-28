<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { AlertCircle } from '@lucide/svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';

	export let form: ActionData;
	let loading = false;
</script>

<div class="container mx-auto flex h-screen items-center justify-center px-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-1 text-center">
			<Card.Title class="text-2xl font-bold">Update Password</Card.Title>
			<Card.Description>Enter your new password below.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if form?.error}
				<Alert variant="destructive" class="mb-4">
					<AlertCircle class="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{form.error}</AlertDescription>
				</Alert>
			{/if}
			{#if form?.success}
				<Alert variant="default" class="mb-4 bg-green-100 text-green-800">
					<AlertTitle>Success</AlertTitle>
					<AlertDescription>
                        Your password has been updated successfully.
                        <a href="/auth" class="font-medium text-primary underline underline-offset-4">Go to Auth page</a>
                    </AlertDescription>
				</Alert>
			{:else}
				<form
					method="POST"
					action="?/updatePassword"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update();
							loading = false;
						};
					}}
					class="space-y-4"
				>
					<div class="space-y-2">
						<Label for="password">New Password</Label>
						<Input id="password" name="password" type="password" required disabled={loading} />
					</div>
					<Button type="submit" class="w-full" disabled={loading}>
						{#if loading}Updating...{:else}Update Password{/if}
					</Button>
				</form>
			{/if}
		</Card.Content>
	</Card.Root>
</div> 