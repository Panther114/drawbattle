<script setup>
defineProps({ items: { type: Array, required: true } });
</script>

<template>
  <TransitionGroup name="gt" tag="div" class="gt-stack" aria-live="polite">
    <div v-for="t in items" :key="t.id" class="gt-item" :class="{ second: t.second }">
      <span class="gt-pts">+{{ t.pts }}</span>
      <span class="gt-text">{{ t.text }}</span>
    </div>
  </TransitionGroup>
</template>
