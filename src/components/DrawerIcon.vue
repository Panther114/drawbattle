<script setup>
defineProps({ size: { type: String, default: 'default' } });
</script>

<template>
  <div class="drawer-icon" :class="{ small: size === 'small' }" />
</template>
