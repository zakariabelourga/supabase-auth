<script lang="ts">
    // You can optionally load data specific to this page here if needed
    // import type { PageData } from './$types';
    // let { data }: { data: PageData } = $props();
</script>

<svelte:head>
    <title>Dashboard</title>
</svelte:head>

<div class="">
    <h1 class="text-3xl font-bold mb-4">Private Dashboard</h1>
    <p class="mb-2">Welcome to the protected area!</p>
    <p class="mb-6">You are successfully logged in.</p>
    
    <p class="mb-2">Manage your account details:</p>
    <a href="/app/account" class="inline-block px-4 py-2 bg-gray-100 text-gray-800 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors">Go to Account Page</a>
</div>

