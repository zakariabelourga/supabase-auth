<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js'; // Import Separator
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js'; // Import Alert components

	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit'; // Import SubmitFunction from @sveltejs/kit

	// Define a more specific type for our form result
	type AuthFormActionResult = ActionResult & {
		// Use ActionResult as base
		values?: { email?: string };
		message?: string;
		errorField?: 'email' | 'password' | 'passwordConfirm' | 'general';
		isSignUp?: boolean;
		success?: boolean;
	};

	// Make form prop optional as it can be undefined
	let { form: formResult }: { form?: AuthFormActionResult } = $props();

	// Use $state for reactivity
	let email = $state(formResult?.values?.email ?? '');
	let password = $state('');
	let passwordConfirm = $state('');
	let showPasswordReset = $state(false);
	let isSignUp = $state(formResult?.isSignUp ?? false);
	let clientError: string | null = $state(null);
	let serverMessage: { text: string; type: 'error' | 'success' } | null = $state(null);

	$effect(() => {
		if (formResult?.values?.email) {
			email = formResult.values.email;
		}

		const cameFromSignUp = formResult?.isSignUp === true;

		if (formResult) {
			if (formResult.type === 'failure') {
				// Only clear passwords on failure if not password field error
				if (formResult.data?.errorField !== 'password' || cameFromSignUp !== isSignUp) {
					password = '';
				}
				if (formResult.data?.errorField !== 'passwordConfirm' || !cameFromSignUp || !isSignUp) {
					passwordConfirm = '';
				}
			}
		} else {
			password = '';
			passwordConfirm = '';
		}

		if (formResult?.type === 'failure' && formResult.data?.message) {
			serverMessage = {
				text: formResult.data.message,
				type: 'error'
			};
		} else if (formResult?.type === 'success' && formResult.data?.message) {
			serverMessage = {
				text: formResult.data.message,
				type: 'success'
			};
		} else {
			serverMessage = null;
		}

		if (formResult?.type === 'failure' && formResult.data?.isSignUp) {
			isSignUp = true;
		}

		clientError = null;
	});

	function validateSignUpForm() {
		clientError = null;
		if (password !== passwordConfirm) {
			clientError = 'Passwords do not match.';
			return false;
		}
		return true;
	}

	function switchToSignUp() {
		isSignUp = true;
		password = '';
		passwordConfirm = '';
		showPasswordReset = false;
		clientError = null;
		serverMessage = null;
		// formResult = undefined; // We don't need to set this, reactivity handles it
	}

	function switchToSignIn() {
		isSignUp = false;
		password = '';
		passwordConfirm = '';
		showPasswordReset = false;
		clientError = null;
		serverMessage = null;
		// formResult = undefined;
	}

	function togglePasswordReset(show: boolean) {
		showPasswordReset = show;
		if (show) {
			isSignUp = false;
		}
		clientError = null;
		serverMessage = null;
		// formResult = undefined;
	}

	// Shared enhance logic
	const enhancedForm: SubmitFunction<AuthFormActionResult, AuthFormActionResult> = () => {
		clientError = null;
		serverMessage = null;
		return async ({
			update
		}: {
			update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			password = '';
			passwordConfirm = '';
			await update({ reset: false }); // prevent form reset by enhance
		};
	};
	// Enhance logic specific to signup
	const enhancedSignUp: SubmitFunction<AuthFormActionResult, AuthFormActionResult> = ({
		cancel
	}) => {
		clientError = null; // Clear client error on new submission attempt
		if (!validateSignUpForm()) {
			cancel(); // Cancel submission if client validation fails
		} else {
			serverMessage = null; // Also clear server message optimistically
			return async ({
				update
			}: {
				update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
			}) => {
				password = '';
				passwordConfirm = '';
				await update({ reset: false });
			};
		}
	};
</script>

<svelte:head>
	<title>{isSignUp ? 'Sign Up' : showPasswordReset ? 'Reset Password' : 'Sign In'}</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center">
	<Card.Root class="w-[400px]">
		{#if !showPasswordReset}
			{#if isSignUp}
				<!-- Sign Up Card -->
				<Card.Header>
					<Card.Title>Create Account</Card.Title>
					<Card.Description>Enter your details to create a new account.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if serverMessage && isSignUp}
						<Alert variant={serverMessage.type === 'error' ? 'destructive' : 'default'}>
							<AlertTitle>{serverMessage.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
							<AlertDescription>{serverMessage.text}</AlertDescription>
						</Alert>
					{/if}
					{#if clientError}
						<Alert variant="destructive">
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{clientError}</AlertDescription>
						</Alert>
					{/if}

					<form method="POST" action="?/register" use:enhance={enhancedSignUp} class="space-y-4">
						<input type="hidden" name="isSignUp" value="true" />
						<div class="grid gap-2">
							<Label for="email-signup">Email</Label>
							<Input
								id="email-signup"
								type="email"
								name="email"
								bind:value={email}
								required
								autocomplete="email"
								placeholder="name@example.com"
							/>
							{#if formResult?.type === 'failure' && formResult.data?.errorField === 'email' && isSignUp}
								<p class="text-sm text-destructive">{serverMessage?.text}</p>
							{/if}
						</div>
						<div class="grid gap-2">
							<Label for="password-signup">Password</Label>
							<Input
								id="password-signup"
								type="password"
								name="password"
								bind:value={password}
								required
								autocomplete="new-password"
							/>
							{#if formResult?.type === 'failure' && formResult.data?.errorField === 'password' && isSignUp}
								<p class="text-sm text-destructive">{serverMessage?.text}</p>
							{/if}
						</div>
						<div class="grid gap-2">
							<Label for="passwordConfirm-signup">Confirm Password</Label>
							<Input
								id="passwordConfirm-signup"
								type="password"
								name="passwordConfirm"
								bind:value={passwordConfirm}
								required
								autocomplete="new-password"
							/>
							{#if formResult?.type === 'failure' && formResult.data?.errorField === 'passwordConfirm' && isSignUp}
								<p class="text-sm text-destructive">{serverMessage?.text}</p>
							{/if}
						</div>
						<Button type="submit" class="w-full">Sign Up</Button>
					</form>
				</Card.Content>
				<Card.Footer class="flex justify-center">
					<Button variant="link" onclick={switchToSignIn}>Already have an account? Sign In</Button>
				</Card.Footer>
			{:else}
				<!-- Sign In Card -->
				<Card.Header>
					<Card.Title>Sign In</Card.Title>
					<Card.Description>Enter your credentials to access your account.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if serverMessage && !isSignUp && !showPasswordReset}
						<Alert variant={serverMessage.type === 'error' ? 'destructive' : 'default'}>
							<AlertTitle>{serverMessage.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
							<AlertDescription>{serverMessage.text}</AlertDescription>
						</Alert>
					{/if}

					<form method="POST" action="?/login" use:enhance={enhancedForm} class="space-y-4">
						<div class="grid gap-2">
							<Label for="email-signin">Email</Label>
							<Input
								id="email-signin"
								type="email"
								name="email"
								bind:value={email}
								required
								autocomplete="username"
								placeholder="name@example.com"
							/>
							{#if formResult?.type === 'failure' && formResult.data?.errorField === 'email' && !isSignUp}
								<p class="text-sm text-destructive">{serverMessage?.text}</p>
							{/if}
						</div>
						<div class="grid gap-2">
							<div class="flex justify-between">
								<Label for="password-signin">Password</Label>
								<Button
									variant="link"
									size="sm"
									class="h-auto"
									onclick={() => togglePasswordReset(true)}>Forgot Password?</Button
								>
							</div>

							<Input
								id="password-signin"
								type="password"
								name="password"
								bind:value={password}
								required
								autocomplete="current-password"
							/>
							{#if formResult?.type === 'failure' && formResult.data?.errorField === 'password' && !isSignUp}
								<p class="text-sm text-destructive">{serverMessage?.text}</p>
							{/if}
						</div>
						<Button type="submit" class="w-full">Sign In</Button>
					</form>

					<!-- OAuth Buttons hidden -->
					<div class="hidden">
						<div class="relative">
							<div class="absolute inset-0 flex items-center">
								<Separator />
							</div>
							<div class="relative flex justify-center text-xs uppercase">
								<span class="bg-background px-2 text-muted-foreground"> Or continue with </span>
							</div>
						</div>
						<div class="grid grid-cols-2 gap-4">
							<form method="POST" action="?/oauth_login" use:enhance={enhancedForm}>
								<input type="hidden" name="provider" value="google" />
								<Button type="submit" variant="outline" class="w-full">Google</Button>
							</form>
							<form method="POST" action="?/oauth_login" use:enhance={enhancedForm}>
								<input type="hidden" name="provider" value="github" />
								<Button type="submit" variant="outline" class="w-full">GitHub</Button>
							</form>
							<!-- Add more provider buttons as needed -->
						</div>
					</div>
				</Card.Content>
				<Card.Footer class="flex">
					<Button variant="link" size="sm" onclick={switchToSignUp}
						>Don't have an account? Sign Up</Button
					>
				</Card.Footer>
			{/if}
		{:else}
			<!-- Password Reset Card -->
			<Card.Header>
				<Card.Title>Reset Password</Card.Title>
				<Card.Description>Enter your email to receive a password reset link.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#if serverMessage && showPasswordReset}
					<Alert variant={serverMessage.type === 'error' ? 'destructive' : 'default'}>
						<AlertTitle>{serverMessage.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
						<AlertDescription>{serverMessage.text}</AlertDescription>
					</Alert>
				{/if}

				<form method="POST" action="?/reset_password" use:enhance={enhancedForm} class="space-y-4">
					<div class="grid gap-2">
						<Label for="email-reset">Email</Label>
						<Input
							id="email-reset"
							type="email"
							name="email"
							bind:value={email}
							required
							autocomplete="email"
							placeholder="name@example.com"
						/>
						{#if formResult?.type === 'failure' && formResult.data?.errorField === 'email' && showPasswordReset}
							<p class="text-sm text-destructive">{serverMessage?.text}</p>
						{/if}
					</div>
					<Button type="submit" class="w-full">Send Reset Link</Button>
				</form>
			</Card.Content>
			<Card.Footer class="flex justify-center">
				<Button variant="link" onclick={() => togglePasswordReset(false)}>Back to Sign In</Button>
			</Card.Footer>
		{/if}
	</Card.Root>
</div>
