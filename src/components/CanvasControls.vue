<script setup>
defineProps({
  drawerTool: { type: String, required: true },
  drawerColor: { type: String, required: true },
  drawerStrokeWidth: { type: Number, required: true },
});
defineEmits(['stroke-width-click', 'color-click', 'pencil-click', 'eraser-click', 'clear-click']);
import { computed } from 'vue';
import { PALETTES, rules } from '../shared.js';
const COLORS = computed(() => PALETTES[rules.palette] || PALETTES.full);
const WIDTHS = [1, 2, 3, 4];
</script>

<template>
  <div>
    <div class="cc-tool-row">
      <button
        v-tooltip="'pencil'"
        class="cc-tool pencil"
        :class="{ selected: drawerTool === 'pencil' }"
        @click="$emit('pencil-click')"
      />
      <button
        v-if="rules.allowEraser"
        v-tooltip="'eraser'"
        class="cc-tool eraser"
        :class="{ selected: drawerTool === 'eraser' }"
        @click="$emit('eraser-click')"
      />
      <button v-if="rules.allowClear" v-tooltip="'clear drawing'" class="cc-tool clear" @click="$emit('clear-click')" />
      <div v-tooltip="'change size'" class="cc-widths">
        <button v-for="w in WIDTHS" :key="w" class="cc-width" @click="$emit('stroke-width-click', w)">
          <div class="cc-width-circle" :class="['w' + w, { selected: drawerStrokeWidth === w }]" />
        </button>
      </div>
    </div>
    <div class="cc-color-row">
      <button
        v-for="c in COLORS"
        :key="c"
        class="cc-color"
        :class="{ selected: drawerColor === c }"
        :style="{ backgroundColor: '#' + c, boxShadow: drawerColor === c ? '0 0 6px #00000060' : '' }"
        @click="$emit('color-click', c)"
      />
    </div>
  </div>
</template>
