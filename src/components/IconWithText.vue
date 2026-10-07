<script setup>
defineProps({
  icon: { type: String, required: true },
  color: { type: String, required: true },
  size: { type: String, default: 'default' },
  hideIconOnSmallViewport: { type: Boolean, default: false },
});
</script>

<template>
  <div class="iwt-root" :class="color === 'yellow' ? 'iwt-yellow' : 'iwt-rorange'">
    <div
      class="iwt-icon"
      :class="[icon === 'headstartClock' ? 'headstart' : icon, { 'iwt-hide-small': hideIconOnSmallViewport }]"
    />
    <div><slot /></div>
  </div>
</template>
