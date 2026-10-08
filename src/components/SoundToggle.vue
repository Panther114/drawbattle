<script setup>
defineProps({ enabled: { type: Boolean, required: true } });
defineEmits(['toggle']);
</script>

<template>
  <button
    type="button"
    class="sound-toggle"
    :class="enabled ? 'on' : 'off'"
    :aria-label="enabled ? 'turn sounds off' : 'turn sounds on'"
    :aria-pressed="enabled"
    @click="$emit('toggle')"
  />
</template>
