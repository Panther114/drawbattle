<script setup>
import { ref } from 'vue';

defineProps({ wordList: Object });
const open = ref(false);
</script>

<template>
  <div class="hm-wp-wrapper">
    <div v-if="wordList !== undefined" class="hm-wp-root">
      <div class="hm-wp-icon" />
      <div class="hm-wp-name-row">
        <span class="hm-wp-name">{{ wordList.name }}</span> word pack
      </div>
      <div v-if="wordList.description !== undefined" class="hm-wp-description">{{ wordList.description }}</div>
      <div class="hm-wp-num-words">
        {{ wordList.numWords }} word{{ wordList.numWords !== 1 ? 's' : '' }}
        <span v-if="wordList.numWords > 0" class="hm-wp-preview">
          (<a class="hm-wp-preview-link" @click.prevent="open = !open">{{ open ? 'hide' : 'preview' }}</a>)
        </span>
      </div>
      <template v-if="open">
        <div class="hm-wp-divider" />
        <div class="hm-wp-sample">
          <div v-for="(w, i) in wordList.sampleWords" :key="i">{{ w }}</div>
        </div>
      </template>
    </div>
  </div>
</template>
