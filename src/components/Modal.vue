<script setup>
import { onMounted, onUnmounted } from 'vue';
defineProps({ wide: { type: Boolean, default: false } });
defineEmits(['close-modal']);
onMounted(() => document.body.classList.add('body-modal-open'));
onUnmounted(() => document.body.classList.remove('body-modal-open'));
</script>

<template>
  <Teleport to="body">
    <div class="modal-container">
      <div class="modal-backdrop" @click="$emit('close-modal')" />
      <div class="modal-body" :class="{ wide }">
        <div class="modal-contents"><slot /></div>
        <button class="modal-close" @click="$emit('close-modal')" />
      </div>
    </div>
  </Teleport>
</template>
