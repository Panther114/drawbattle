<script setup>
import { computed } from 'vue';

// Small two-tone icons: a soft tinted fill plus a rounded outline, both in currentColor.
// 'f' parts are filled (tinted) and outlined, 's' parts are outline only.
const ICONS = {
  people: [
    ['f', 'M9 4.8a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4z'],
    ['s', 'M3.2 19.2c0-3.2 2.5-5.2 5.8-5.2s5.8 2 5.8 5.2'],
    ['f', 'M16.6 6.6a2.6 2.6 0 110 5.2 2.6 2.6 0 010-5.2z'],
    ['s', 'M16.8 14.2c2.6.2 4.2 1.9 4.2 4.6'],
  ],
  pencil: [
    ['f', 'M4 20l1-4.5L16.5 4a2.1 2.1 0 013 3L8 18.5z'],
    ['s', 'M14.5 6l3 3'],
  ],
  chart: [
    ['f', 'M4.5 13h3.5v7H4.5z'],
    ['f', 'M10.3 8h3.5v12h-3.5z'],
    ['f', 'M16 4h3.5v16H16z'],
  ],
  code: [['s', 'M9 7l-5 5 5 5M15 7l5 5-5 5M13.5 5l-3 14']],
  moon: [['f', 'M20 14.6A8.4 8.4 0 119.4 4a6.6 6.6 0 0010.6 10.6z']],
  sun: [
    ['f', 'M12 7.8a4.2 4.2 0 100 8.4 4.2 4.2 0 000-8.4z'],
    ['s', 'M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7'],
  ],
  home: [
    ['f', 'M4 11l8-7 8 7v8.5H4z'],
    ['s', 'M10 19.5v-5h4v5'],
  ],
  chat: [
    ['f', 'M4 5.5h16a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5H11l-4.5 3.5V17.5H4A1.5 1.5 0 012.5 16V7A1.5 1.5 0 014 5.5z'],
    ['s', 'M8 11.2h.01M12 11.2h.01M16 11.2h.01'],
  ],
  send: [['f', 'M3.5 11.5l16-7-6 15-2.6-6.4z']],
  ban: [
    ['f', 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17z'],
    ['s', 'M6 6l12 12'],
  ],
  check: [['s', 'M5 12.5l4.5 4.5L19 7.5']],
  swap: [['s', 'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4']],
  trash: [
    ['f', 'M7 7l1 13h8l1-13z'],
    ['s', 'M4.5 7h15M9 7V4.5h6V7'],
  ],
  sparkle: [
    ['f', 'M11 3l2 6.2 6.2 2-6.2 2L11 19.4l-2-6.2-6.2-2 6.2-2z'],
    ['s', 'M19 3.5v3M17.5 5h3'],
  ],
  enter: [['s', 'M4 12h11M11 7l5 5-5 5M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4']],
  eye: [
    ['f', 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'],
    ['s', 'M12 9.4a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2z'],
  ],
  play: [['f', 'M8 5l11 7-11 7z']],
  next: [['s', 'M4 12h15M13 6l6 6-6 6']],
  back: [['s', 'M20 12H5M11 6l-6 6 6 6']],
  copy: [
    ['f', 'M9 9h11v11H9z'],
    ['s', 'M5 15V4h11'],
  ],
  sliders: [
    ['s', 'M4 7h9M19 7h1M4 17h3M13 17h7'],
    ['f', 'M16 4.8a2.2 2.2 0 100 4.4 2.2 2.2 0 000-4.4z'],
    ['f', 'M10 14.8a2.2 2.2 0 100 4.4 2.2 2.2 0 000-4.4z'],
  ],
  bolt: [['f', 'M13.5 2.8L5 13.6h5.8l-1.3 7.6L19 9.8h-6z']],
  shuffle: [
    ['s', 'M3.5 7.5h3.2c4.5 0 4.6 9 9.1 9h4.7M3.5 16.5h3.2c1.6 0 2.6-1.2 3.4-2.6M13.9 10.1c.7-1.4 1.7-2.6 3.5-2.6h2.9'],
    ['s', 'M17.5 4.5l3 3-3 3M17.5 13.5l3 3-3 3'],
  ],
  trophy: [
    ['f', 'M7.5 4h9v5.5a4.5 4.5 0 01-9 0z'],
    ['s', 'M7.5 6H4.5v1.5a3 3 0 003 3M16.5 6h3v1.5a3 3 0 01-3 3M12 14v3.5M8.5 20h7M10 17.5h4'],
  ],
  list: [
    ['f', 'M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z'],
    ['s', 'M8 9h8M8 13h8M8 17h4'],
  ],
};

const props = defineProps({ name: { type: String, required: true } });
const parts = computed(() => ICONS[props.name] ?? []);
</script>

<template>
  <svg class="ic" :class="'ic-' + name" viewBox="0 0 24 24" aria-hidden="true">
    <path
      v-for="(p, i) in parts"
      :key="i"
      :d="p[1]"
      :fill="p[0] === 'f' ? 'currentColor' : 'none'"
      :fill-opacity="p[0] === 'f' ? 0.22 : 0"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
