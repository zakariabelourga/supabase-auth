<script lang="ts">
    import type { ActionData } from './$types';
    import { enhance } from '$app/forms';

    let { form }: { form: ActionData } = $props();

    // Reactive state for form values (useful for pre-filling on error)
    let email = $state(form?.values?.email ?? '');
    let password = $state('');
    let showPasswordReset = $state(false);

    // Update email if form values change (e.g., after server-side validation error)
    $effect(() => {
        if (form?.values?.email) {
            email = form.values.email;
        }
    });
</script>

<svelte:head>
    <title>Sign In / Sign Up</title>
</svelte:head>

<div class="auth-container">
    <h1>Welcome</h1>

    {#if form?.message}
        <p class="error">{form.message}</p>
    {/if}

    {#if !showPasswordReset}
        <!-- Login/Register Form -->
        <form method="POST" action="?/login" use:enhance>
            <h2>Sign In</h2>
            <label>
                Email:
                <input type="email" name="email" bind:value={email} required />
            </label>
            <label>
                Password:
                <input type="password" name="password" bind:value={password} required />
            </label>
            <button type="submit">Sign In</button>
            <button type="submit" formaction="?/register">Sign Up</button>
        </form>

        <!-- OAuth Buttons -->
        <div class="oauth-buttons">
            <h3>Or sign in with:</h3>
            <form method="POST" action="?/oauth_login" use:enhance>
                <input type="hidden" name="provider" value="google" />
                <button type="submit">Google</button>
            </form>
            <form method="POST" action="?/oauth_login" use:enhance>
                <input type="hidden" name="provider" value="github" />
                <button type="submit">GitHub</button>
            </form>
            <!-- Add more provider buttons as needed -->
        </div>

        <button class="link" onclick={() => showPasswordReset = true}>Forgot Password?</button>
    {:else}
        <!-- Password Reset Form -->
        <form method="POST" action="?/reset_password" use:enhance>
            <h2>Reset Password</h2>
            <p>Enter your email address and we'll send you a link to reset your password.</p>
            <label>
                Email:
                <input type="email" name="email" bind:value={email} required />
            </label>
            <button type="submit">Send Reset Link</button>
        </form>
        <button class="link" onclick={() => showPasswordReset = false}>Back to Sign In</button>
    {/if}
</div>

<style>
    .auth-container {
        max-width: 400px;
        margin: 2rem auto;
        padding: 2rem;
        border: 1px solid #ccc;
        border-radius: 8px;
        text-align: center;
    }
    form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1rem;
    }
    label {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }
    input {
        width: 100%;
        padding: 0.5rem;
        margin-top: 0.25rem;
        box-sizing: border-box;
    }
    button {
        padding: 0.75rem;
        cursor: pointer;
    }
    button[type="submit"] {
        background-color: #333;
        color: white;
        border: none;
        border-radius: 4px;
    }
    button[formaction="?/register"] {
        background-color: #555;
    }
    .oauth-buttons {
        margin-top: 1.5rem;
        border-top: 1px solid #eee;
        padding-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .oauth-buttons form {
        margin-bottom: 0;
    }
    .oauth-buttons button {
        width: 100%;
        background-color: #eee;
        color: #333;
        border: 1px solid #ccc;
    }
    .error {
        color: red;
        margin-bottom: 1rem;
    }
    .link {
        background: none;
        border: none;
        color: blue;
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
        margin-top: 1rem;
    }
</style> 