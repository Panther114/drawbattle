import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Home from './views/Home.vue';
import Game from './views/Game.vue';
import Terms from './views/Terms.vue';
import Debug from './views/Debug.vue';
import WordPacks from './views/WordPacks.vue';
import Lobbies from './views/Lobbies.vue';
import { tooltip } from './tooltip.js';
import { loadOfficialPacks } from './wordpacks.js';
import './style.css';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    props: (route) => ({ ...route.query, ...route.params }),
  },
  { path: '/terms', name: 'Terms of Service', component: Terms },
  { path: '/debug', name: 'Debug', component: Debug },
  { path: '/wordpacks', name: 'WordPacks', component: WordPacks },
  { path: '/lobbies', name: 'Lobbies', component: Lobbies },
  { path: '/wordpack/:wordListId(\\d+)', name: 'Wordpack', component: Home, props: true },
  {
    path: '/:gameId([a-zA-Z]{4})',
    name: 'Game',
    component: Game,
    // the game component reconnects fresh when the code changes
    props: (route) => ({
      connectedUsername: route.query.connectedUsername,
      summaryUrl: route.query.summaryUrl,
      spectateOnLoad: route.query.spectate === '1',
      ...route.params,
    }),
  },
];

const router = createRouter({ history: createWebHistory('/'), routes });
const app = createApp(App);
app.directive('tooltip', tooltip);
app.use(router);
void loadOfficialPacks();
app.mount('#app');
