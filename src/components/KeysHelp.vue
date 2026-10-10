<script setup>
import { Prio, helpGroups, keys, useKeys } from '../keys.js';
import KeyHint from './KeyHint.vue';
import Modal from './Modal.vue';

// the key that opened the sheet closes it again
useKeys([{ key: '?', run: () => (keys.help = false) }], { prio: Prio.modal, modal: true });
</script>

<template>
  <Modal wide @close-modal="keys.help = false">
    <div class="kb-root">
      <div class="kb-title">keyboard shortcuts</div>
      <div class="kb-sub">single keys work whenever you are not typing in a box. press <KeyHint k="esc" /> to leave a box</div>
      <div class="kb-groups">
        <section v-for="g in helpGroups" :key="g.title" class="kb-group">
          <div class="kb-group-title">{{ g.title }}</div>
          <div v-for="e in g.items" :key="e.id" class="kb-row">
            <span class="kb-keys"><template v-for="(k, i) in e.keys" :key="k"><span v-if="i > 0" class="kb-or">/</span><KeyHint :k="k" /></template></span>
            <span class="kb-label">{{ e.label }}</span>
          </div>
        </section>
      </div>
    </div>
  </Modal>
</template>
