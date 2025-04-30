<script lang="ts">
    import type { ActionData, PageData } from './$types';
    import { enhance } from '$app/forms';
    import type { ActionResult, SubmitFunction } from '@sveltejs/kit'; // Import SubmitFunction from @sveltejs/kit

    // Define a more specific type for our form result
    type AuthFormActionResult = ActionResult & { // Use ActionResult as base
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
            if (formResult.type === 'failure') { // Only clear passwords on failure if not password field error
                 if (formResult.data?.errorField !== 'password' || (cameFromSignUp !== isSignUp) ) {
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
        return async ({ update }: { update: (options?: { reset?: boolean; invalidateAll?: boolean; }) => Promise<void>; }) => {
            password = '';
            passwordConfirm = '';
            await update({ reset: false }); // prevent form reset by enhance
        };
    };
     // Enhance logic specific to signup
     const enhancedSignUp: SubmitFunction<AuthFormActionResult, AuthFormActionResult> = ({ cancel }) => {
         clientError = null; // Clear client error on new submission attempt
         if (!validateSignUpForm()) {
             cancel(); // Cancel submission if client validation fails
         } else {
            serverMessage = null; // Also clear server message optimistically
            return async ({ update }: { update: (options?: { reset?: boolean; invalidateAll?: boolean; }) => Promise<void>; }) => {
                password = '';
                passwordConfirm = '';
                await update({ reset: false });
            };
         }
     };

</script>

<svelte:head>
    <title>{isSignUp ? 'Sign Up' : (showPasswordReset ? 'Reset Password' : 'Sign In')}</title>
</svelte:head>

<div class="auth-container">

    {#if !showPasswordReset}
        {#if isSignUp}
            <!-- Sign Up Form -->
            <h1>Create Account</h1>
            {#if serverMessage && isSignUp} <p class={serverMessage.type}>{serverMessage.text}</p> {/if}
            {#if clientError} <p class="error">{clientError}</p> {/if}

            <form method="POST" action="?/register" use:enhance={enhancedSignUp}>
                <input type="hidden" name="isSignUp" value="true"/>
                <label>
                    Email:
                    <input type="email" name="email" bind:value={email} required autocomplete="email" />
                    {#if formResult?.type === 'failure' && formResult.data?.errorField === 'email' && isSignUp}<p class="field-error">{serverMessage?.text}</p>{/if}
                </label>
                <label>
                    Password:
                    <input type="password" name="password" bind:value={password} required autocomplete="new-password" />
                    {#if formResult?.type === 'failure' && formResult.data?.errorField === 'password' && isSignUp}<p class="field-error">{serverMessage?.text}</p>{/if}
                </label>
                <label>
                    Confirm Password:
                    <input type="password" name="passwordConfirm" bind:value={passwordConfirm} required autocomplete="new-password" />
                    {#if formResult?.type === 'failure' && formResult.data?.errorField === 'passwordConfirm' && isSignUp}<p class="field-error">{serverMessage?.text}</p>{/if}
                </label>
                <button type="submit">Sign Up</button>
            </form>
            <button class="link" onclick={switchToSignIn}>Already have an account? Sign In</button>

        {:else}
            <!-- Sign In Form -->
            <h1>Sign In</h1>
            {#if serverMessage && !isSignUp && !showPasswordReset} <p class={serverMessage.type}>{serverMessage.text}</p> {/if}

            <form method="POST" action="?/login" use:enhance={enhancedForm}>
                <label>
                    Email:
                    <input type="email" name="email" bind:value={email} required autocomplete="username"/>
                     {#if formResult?.type === 'failure' && formResult.data?.errorField === 'email' && !isSignUp}<p class="field-error">{serverMessage?.text}</p>{/if}
                </label>
                <label>
                    Password:
                    <input type="password" name="password" bind:value={password} required autocomplete="current-password" />
                     {#if formResult?.type === 'failure' && formResult.data?.errorField === 'password' && !isSignUp}<p class="field-error">{serverMessage?.text}</p>{/if}
                </label>
                <button type="submit">Sign In</button>
            </form>

            <!-- OAuth Buttons -->
            <div class="oauth-buttons">
                <h3>Or sign in with:</h3>
                <form method="POST" action="?/oauth_login" use:enhance={enhancedForm}>
                    <input type="hidden" name="provider" value="google" />
                    <button type="submit">Google</button>
                </form>
                <form method="POST" action="?/oauth_login" use:enhance={enhancedForm}>
                    <input type="hidden" name="provider" value="github" />
                    <button type="submit">GitHub</button>
                </form>
                <!-- Add more provider buttons as needed -->
            </div>

            <div class="auth-links">
                 <button class="link" onclick={() => togglePasswordReset(true)}>Forgot Password?</button>
                 <button class="link" onclick={switchToSignUp}>Don't have an account? Sign Up</button>
            </div>
        {/if}

    {:else}
        <!-- Password Reset Form -->
         <h1>Reset Password</h1>
         {#if serverMessage && showPasswordReset} <p class={serverMessage.type}>{serverMessage.text}</p> {/if}

        <form method="POST" action="?/reset_password" use:enhance={enhancedForm}>
            <p>Enter your email address and we'll send you a link to reset your password.</p>
            <label>
                Email:
                <input type="email" name="email" bind:value={email} required autocomplete="email" />
                 {#if formResult?.type === 'failure' && formResult.data?.errorField === 'email' && showPasswordReset}<p class="field-error">{serverMessage?.text}</p>{/if}
            </label>
            <button type="submit">Send Reset Link</button>
        </form>
        <button class="link" onclick={() => togglePasswordReset(false)}>Back to Sign In</button>
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
    h1 {
        margin-bottom: 1.5rem;
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
        text-align: left; /* Align label text left */
        width: 100%;
    }
    input {
        width: 100%;
        padding: 0.5rem;
        margin-top: 0.25rem;
        box-sizing: border-box;
         border: 1px solid #ccc; /* Add border */
        border-radius: 4px; /* Add border-radius */
    }
    button {
        padding: 0.75rem;
        cursor: pointer;
        border-radius: 4px; /* Add border-radius */
        border: none; /* Remove default border */
        transition: background-color 0.2s ease; /* Add transition */
    }
    button:hover {
        opacity: 0.9; /* Slight hover effect */
    }

    button[type="submit"] {
        background-color: #333;
        color: white;
    }
    button[type="submit"]:hover {
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
     .oauth-buttons button:hover {
        background-color: #ddd;
    }

    .error, .success {
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
        text-align: center;
        border: 1px solid transparent;
    }
    .error {
        color: hsl(0, 60%, 50%); /* Softer red */
        background-color: hsl(0, 100%, 95%); /* Light red background */
        border-color: hsl(0, 60%, 80%);
    }
     .success { /* Style for success messages */
        color: hsl(120, 60%, 30%);
        background-color: hsl(120, 100%, 95%);
        border-color: hsl(120, 60%, 80%);
    }
    .field-error { /* Style for specific field errors */
        color: hsl(0, 60%, 50%);
        font-size: 0.8rem;
        margin-top: 0.2rem;
    }
    .link {
        background: none;
        border: none;
        color: #007bff; /* Standard link blue */
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
        margin-top: 0.5rem; /* Adjusted margin */
        font-size: 0.9rem; /* Slightly smaller */
    }
    .link:hover {
        color: #0056b3;
    }
    /* Container for Sign In links */
    .auth-links {
        margin-top: 1rem;
        display: flex;
        justify-content: space-between; /* Space out links */
        align-items: center;
        font-size: 0.9rem;
    }

</style> 