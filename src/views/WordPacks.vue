<script setup>
import WordPackEditor from '../components/WordPackEditor.vue';
import Footer from '../components/Footer.vue';
</script>

<template>
  <div class="wpp-root">
    <div class="wpp-title">word pack editor</div>
    <div class="wpp-sub">clone the official pack or start fresh, edit it your way, then pick it in any lobby</div>
    <div class="wpp-box"><WordPackEditor /></div>
    <router-link to="/" class="wpp-back">back to home</router-link>
    <Footer />
  </div>
</template>
