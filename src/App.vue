<template>
  <router-view v-slot="{ Component, route }">
    <component :is="Component" :key="route.params.gameId ? String(route.params.gameId).toLowerCase() : route.path" />
  </router-view>
</template>
