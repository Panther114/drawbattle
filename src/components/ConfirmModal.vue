<script setup>
import { Prio, useKeys } from '../keys.js';
import Btn from './Btn.vue';
import KeyHint from './KeyHint.vue';
import Modal from './Modal.vue';

// A yes / no question: Enter says yes, Esc says no.
// With escConfirms the keys swap: the Esc that opened the question confirms it when pressed again, and Enter (the key
// people hammer to get back into the game) safely says no.
const props = defineProps({
  title: { type: String, required: true },
  text: { type: String, default: '' },
  okLabel: { type: String, default: 'ok' },
  cancelLabel: { type: String, default: 'cancel' },
  escConfirms: { type: Boolean, default: false },
});
const emit = defineEmits(['confirm', 'close-modal']);

if (props.escConfirms) {
  useKeys(
    [
      { key: 'esc', typing: true, press: '.cf-actions', run: () => emit('confirm') },
      { key: 'enter', press: '.cf-actions', run: () => emit('close-modal') },
    ],
    { prio: Prio.modal + 1, modal: true },
  );
}
</script>

<template>
  <Modal confirmable @confirm="emit('confirm')" @close-modal="emit('close-modal')">
    <div class="cf-root">
      <div class="cf-title">{{ title }}</div>
      <div v-if="text" class="cf-text">{{ text }}</div>
      <div class="cf-actions">
        <button type="button" class="cf-cancel" @click="emit('close-modal')">{{ cancelLabel }}<KeyHint :k="escConfirms ? 'enter' : 'esc'" /></button>
        <Btn size="small" :force-rotation="-1" :hint="escConfirms ? 'esc' : 'enter'" @click="emit('confirm')">{{ okLabel }}</Btn>
      </div>
    </div>
  </Modal>
</template>
