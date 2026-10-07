<script setup>
import { computed } from 'vue';
defineOptions({ inheritAttrs: false });
const props = defineProps({
  color: { type: String, default: 'blue' },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'default' },
  forceRotation: Number,
  wordChoiceButton: { type: Boolean, default: false },
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
      <slot />
    </button>
  </div>
</template>
