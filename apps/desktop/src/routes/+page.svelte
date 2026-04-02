<script lang="ts">
  import Editor from '$lib/components/Editor.svelte';
</script>

<main class="app">
  <Editor />
</main>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
</style>
