<script setup>
import { ref } from 'vue';
import { useReveal } from './reveal.js';

const root = ref();
useReveal(root);
</script>

<template>
  <section ref="root" class="hm-how-section">
    <div class="hm-how-head" data-reveal>
      <div class="hm-eyebrow">three steps, zero art skills</div>
      <div class="hm-how-header" role="heading" aria-level="2">how to play</div>
    </div>
    <div class="hm-how">
      <div class="hm-how-row hm-step1" data-reveal>
        <div class="hm-how-num" aria-hidden="true">1</div>
        <div class="hm-how-art"><div class="hm-how-icon team" /></div>
        <div class="hm-how-text">split up into two teams of 2 or <span class="hm-nobr">more players</span></div>
      </div>
      <div class="hm-how-row hm-step2" data-reveal>
        <div class="hm-how-num" aria-hidden="true">2</div>
        <div class="hm-how-art"><div class="hm-how-icon draw" /></div>
        <div class="hm-how-text">draw and guess each word before the <span class="hm-nobr">other team</span></div>
      </div>
      <div class="hm-how-row hm-step3" data-reveal>
        <div class="hm-how-num" aria-hidden="true">3</div>
        <div class="hm-how-art"><div class="hm-how-icon replay" /></div>
        <div class="hm-how-text">replay the same words again in a frantic <span class="hm-nobr">final round</span></div>
      </div>
    </div>
  </section>
</template>
