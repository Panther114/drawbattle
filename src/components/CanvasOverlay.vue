<script setup>
defineProps({
  verticalCenter: { type: Boolean, default: false },
  size: { type: Number, required: true },
});
</script>

<template>
  <div class="co-overlay" :class="{ 'co-small': size === 1 }">
    <div class="co-contents" :class="{ vcenter: verticalCenter }"><slot /></div>
    <div class="co-top-left"><slot name="topLeft" /></div>
    <div class="co-top-right"><slot name="topRight" /></div>
    <div class="co-bottom"><slot name="bottom" /></div>
  </div>
</template>
