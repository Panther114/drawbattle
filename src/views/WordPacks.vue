<script setup>
import WordPackEditor from '../components/WordPackEditor.vue';
import Icon from '../components/Icon.vue';
import TopNav from '../components/TopNav.vue';
</script>

<template>
  <div class="wpp-root">
    <TopNav><router-link to="/" class="nav-home"><Icon name="home" />back to home</router-link></TopNav>
    <div class="wpp-title">word pack editor</div>
    <div class="wpp-sub">clone the official pack or start fresh, edit it your way, then pick it in any lobby</div>
    <div class="wpp-box"><WordPackEditor /></div>
  </div>
</template>
