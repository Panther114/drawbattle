<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';
import KeyHint from './KeyHint.vue';
defineOptions({ inheritAttrs: false });
const props = defineProps({
  color: { type: String, default: 'blue' },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'default' },
  forceRotation: Number,
  wordChoiceButton: { type: Boolean, default: false },
  icon: { type: String, default: '' },
  hint: { type: String, default: '' }, // the key that does the same, shown as a small keycap
});
// each button keeps a fixed random tilt, like the hand-drawn original
const rotation = computed(() => props.forceRotation ?? 3 - Math.round(6 * Math.random()));
</script>

<template>
  <div class="btn-root" :class="$attrs.class" :style="{ transform: `rotate(${rotation}deg)` }">
    <button
      v-bind="{ ...$attrs, class: undefined }"
      class="btn"
      :class="[color, { small: size === 'small', 'word-choice': wordChoiceButton }]"
      :disabled="disabled"
    >
      <Icon v-if="icon" :name="icon" class="btn-icon" />
      <slot />
      <KeyHint v-if="hint" :k="hint" />
    </button>
  </div>
</template>
