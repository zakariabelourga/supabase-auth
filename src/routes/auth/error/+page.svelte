<svelte:head>
    <title>Authentication Error</title>
</svelte:head>

<div class="container error">
    <h1>Authentication Error</h1>
    <p>Sorry, something went wrong during the authentication process.</p>
    <p>This could be due to an invalid link, expired token, or a server issue.</p>
    <p>Please try signing in again.</p>
    <p><a href="/auth">Go to Sign In</a></p>
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
    .error {
        border-color: red;
        background-color: #ffebeb;
    }
    h1 {
        color: red;
    }
     a {
        color: blue;
    }
</style> 