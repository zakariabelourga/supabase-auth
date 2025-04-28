<script lang="ts">
    // You can optionally load data specific to this page here if needed
    // import type { PageData } from './$types';
    // let { data }: { data: PageData } = $props();
</script>

<svelte:head>
    <title>Dashboard</title>
</svelte:head>

<div class="private-home">
    <h1>Private Dashboard</h1>
    <p>Welcome to the protected area!</p>
    <p>You are successfully logged in.</p>
    
    <p>Manage your account details:</p>
    <a href="/private/account">Go to Account Page</a>
</div>

<style>
    .private-home {
        padding: 1rem;
    }
    a {
        display: inline-block;
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background-color: #eee;
        color: #333;
        border: 1px solid #ccc;
        border-radius: 4px;
        text-decoration: none;
    }
    a:hover {
        background-color: #ddd;
    }
</style>

