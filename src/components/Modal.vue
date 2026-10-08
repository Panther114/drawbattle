<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
defineProps({ wide: { type: Boolean, default: false } });
const emit = defineEmits(['close-modal']);
// play the exit animation before the parent removes the dialog
const closing = ref(false);
let timer;
function close() {
  if (closing.value) return;
  closing.value = true;
  timer = setTimeout(() => emit('close-modal'), 170);
}
onUnmounted(() => clearTimeout(timer));
onMounted(() => document.body.classList.add('body-modal-open'));
onUnmounted(() => document.body.classList.remove('body-modal-open'));
</script>

<template>
  <Teleport to="body">
    <div class="modal-container" :class="{ closing }">
      <div class="modal-backdrop" @click="close" />
      <div class="modal-body" :class="{ wide }">
        <div class="modal-contents"><slot /></div>
        <button class="modal-close" @click="close" />
      </div>
    </div>
  </Teleport>
</template>
