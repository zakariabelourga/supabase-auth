<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";

    onMount(() => {
        goto("/app");
    });
  </script>

  <!-- This page will be the landing page for this saas-->
   
