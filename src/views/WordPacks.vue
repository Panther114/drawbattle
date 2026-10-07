<script setup>
import WordPackEditor from '../components/WordPackEditor.vue';
import Footer from '../components/Footer.vue';
</script>

<template>
  <div class="wpp-root">
    <div class="wpp-title">word pack creator</div>
    <div class="wpp-sub">make your own packs or import a folder of word lists, then pick one in any lobby</div>
    <div class="wpp-box"><WordPackEditor /></div>
    <router-link to="/" class="wpp-back">back to home</router-link>
    <Footer />
  </div>
</template>
