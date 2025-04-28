<svelte:head>
    <title>Check Email for Reset Link</title>
</svelte:head>

<div class="container">
    <h1>Check Your Email</h1>
    <p>If an account exists for the email address you provided, we've sent a link to reset your password.</p>
    <p>Please check your inbox (and spam folder).</p>
    <p><a href="/auth">Back to Sign In</a></p>
</div>

<style>
    .container {
        max-width: 500px;
        margin: 2rem auto;
        padding: 2rem;
        text-align: center;
        border: 1px solid #eee;
        border-radius: 8px;
    }
     a {
        color: blue;
    }
</style> 