<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { Prio, useKeys } from '../keys.js';
const props = defineProps({ wide: { type: Boolean, default: false }, confirmable: { type: Boolean, default: false } });
const emit = defineEmits(['close-modal', 'confirm']);
// play the exit animation before the parent removes the dialog
const closing = ref(false);
let timer;
function close() {
  if (closing.value) return;
  closing.value = true;
  timer = setTimeout(() => emit('close-modal'), 170);
}
onUnmounted(() => clearTimeout(timer));
// Esc closes, and Enter confirms in a dialog that asks something; no other key works while a dialog is open
useKeys(
  [
    { key: 'esc', typing: true, run: close },
    { key: 'enter', when: () => props.confirmable, run: () => emit('confirm') },
  ],
  { prio: Prio.modal, modal: true },
);
onMounted(() => document.body.classList.add('body-modal-open'));
onUnmounted(() => document.body.classList.remove('body-modal-open'));
</script>

<template>
  <Teleport to="body">
    <div class="modal-container" :class="{ closing }">
      <div class="modal-backdrop" @click="close" />
      <div class="modal-body" :class="{ wide }">
        <div class="modal-contents"><slot /></div>
        <button type="button" class="modal-close" aria-label="close" @click="close" />
      </div>
    </div>
  </Teleport>
</template>
