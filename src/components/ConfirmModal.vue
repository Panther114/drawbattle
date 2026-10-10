<script setup>
import Btn from './Btn.vue';
import KeyHint from './KeyHint.vue';
import Modal from './Modal.vue';

// A yes / no question: Enter says yes, Esc says no.
defineProps({
  title: { type: String, required: true },
  text: { type: String, default: '' },
  okLabel: { type: String, default: 'ok' },
  cancelLabel: { type: String, default: 'cancel' },
});
const emit = defineEmits(['confirm', 'close-modal']);
</script>

<template>
  <Modal confirmable @confirm="emit('confirm')" @close-modal="emit('close-modal')">
    <div class="cf-root">
      <div class="cf-title">{{ title }}</div>
      <div v-if="text" class="cf-text">{{ text }}</div>
      <div class="cf-actions">
        <button type="button" class="cf-cancel" @click="emit('close-modal')">{{ cancelLabel }}<KeyHint k="esc" /></button>
        <Btn size="small" :force-rotation="-1" hint="enter" @click="emit('confirm')">{{ okLabel }}</Btn>
      </div>
    </div>
  </Modal>
</template>
