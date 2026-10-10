<script setup>
import Icon from '../Icon.vue';

// a strip of tape across the page with the game's features sliding past (the list runs twice so the loop is seamless)
const ITEMS = ['frantic final round', 'custom word packs', 'letter hints', 'random teams', 'spectator mode', 'quick reactions', 'live stats', 'streamer mode', 'keyboard shortcuts', 'dark mode'];
const ICONS = ['sparkle', 'bolt', 'pencil', 'trophy'];
</script>

<template>
  <div class="hm-marquee" aria-hidden="true">
    <div class="hm-marquee-band">
      <div class="hm-marquee-track">
        <template v-for="copy in 2" :key="copy">
          <span v-for="(item, i) in ITEMS" :key="`${copy}-${i}`" class="hm-marquee-item">
            <Icon :name="ICONS[i % ICONS.length]" class="hm-marquee-icon" />{{ item }}
          </span>
        </template>
      </div>
    </div>
  </div>
</template>
