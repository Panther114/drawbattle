<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { closeQuick, qs, qsIsHtmlFile, qsIsPdf, qsSrc, registerCover, registerFrame } from '../quickswitch.js';
import Icon from './Icon.vue';
import PdfCover from './PdfCover.vue';

// The cover page is loaded once, as soon as a game page is on screen, and only shown / hidden afterwards:
// switching is instant and the page keeps whatever state it had.
const frame = ref();
const wrap = ref();
const loadedSrc = ref('');

watch(
  () => [qs.armed, qs.open, qsSrc.value, qs.display],
  ([armed, , src, display]) => {
    if (display === 'frame' && src && (armed || qs.open || loadedSrc.value)) loadedSrc.value = src;
    if (display !== 'frame' || !src) loadedSrc.value = '';
  },
  { immediate: true },
);
watch(frame, (el) => registerFrame(el ?? undefined));
onMounted(() => registerCover(wrap.value));
onBeforeUnmount(() => {
  registerFrame(undefined);
  registerCover(undefined);
});
</script>

<template>
  <div ref="wrap" class="qs-cover" :class="{ open: qs.open && qs.display === 'frame' }" tabindex="-1" :inert="qs.open && qs.display === 'frame' ? undefined : ''">
    <PdfCover v-if="loadedSrc && qsIsPdf" :src="loadedSrc" :open="qs.open" />
    <iframe
      v-else-if="loadedSrc"
      ref="frame"
      class="qs-frame"
      :src="loadedSrc"
      title="quick switch"
      referrerpolicy="no-referrer"
      allow="clipboard-read; clipboard-write; fullscreen; autoplay"
      :sandbox="qsIsHtmlFile ? 'allow-scripts allow-forms allow-popups allow-modals allow-downloads' : undefined"
    />
    <button class="qs-exit" aria-label="back to the game" title="back to the game" @click="closeQuick"><Icon name="bolt" /></button>
  </div>
</template>
