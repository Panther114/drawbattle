<script setup>
import { packs } from '../wordpacks.js';
import KeyHint from './KeyHint.vue';

const props = defineProps({
  wordListId: { type: Number, required: true },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  rotate: { type: Boolean, default: false },
  tagText: { type: String },
  hint: { type: String, default: '' }, // the key that picks this pack
});
defineEmits(['select-list']);

// small fixed random tilt per item
const rotation = Math.floor(160 * Math.random()) / 100 - 0.8;
</script>

<template>
  <button
    type="button"
    class="wp-item"
    :class="{ selected }"
    :style="{ rotate: rotate ? `${rotation}deg` : undefined }"
    :disabled="disabled"
    @click="$emit('select-list')"
  >
    <template v-if="packs[wordListId] !== undefined">
      <div>
        {{ packs[wordListId].name }}
        <span v-if="packs[wordListId].authorName !== undefined">
          <span class="wp-author-by"> by </span>
          <span class="wp-author-name">{{ packs[wordListId].authorName }}</span>
        </span>
      </div>
      <div class="wp-description">
        <span v-if="packs[wordListId].description !== undefined">
          {{ packs[wordListId].description }}
          <span class="wp-num-words">({{ packs[wordListId].numWords }} words)</span>
        </span>
        <template v-else>{{ packs[wordListId].numWords }} words</template>
      </div>
    </template>
    <div v-else>{{ wordListId }}</div>
    <KeyHint v-if="hint" :k="hint" class="wp-hint" />
    <div v-if="tagText !== undefined" class="wp-tag">{{ tagText }}</div>
    <div
      v-else-if="packs[wordListId] && packs[wordListId].sampleWords.length > 0"
      v-tooltip="packs[wordListId].sampleWords.join(', ')"
      class="wp-preview-icon"
    />
  </button>
</template>
