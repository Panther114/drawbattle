<script setup>
defineProps({ enabled: { type: Boolean, required: true } });
defineEmits(['toggle']);
</script>

<template>
  <button class="sound-toggle" :class="enabled ? 'on' : 'off'" @click="$emit('toggle')" />
</template>
