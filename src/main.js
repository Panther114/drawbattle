import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Home from './views/Home.vue';
import Game from './views/Game.vue';
import Terms from './views/Terms.vue';
import Debug from './views/Debug.vue';
import WordPacks from './views/WordPacks.vue';
import { tooltip } from './tooltip.js';
import { loadOfficialPacks } from './wordpacks.js';
import './style.css';

const LIST_ALIASES = { hades: 198903, taiwan: 170398, holidays: 332670, 2020: 796082 };

// vanity URLs that open the home page with a word pack preselected
const packRoutes = [
  ['/pokemon', 138239],
  ['/election2020', 252520],
  ['/taiwan', 170398],
  ['/lunarnewyear', 178976],
].map(([path, id]) => ({
  path,
  component: Home,
  props: (route) => ({ ...route.params, wordListId: String(id) }),
}));

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    props: (route) => {
      const q = { ...route.query };
      if (typeof q.list === 'string' && LIST_ALIASES[q.list] !== undefined) {
        q.wordListId = `${LIST_ALIASES[q.list]}`;
        delete q.list;
      }
      return { ...q, ...route.params };
    },
  },
  ...packRoutes,
  { path: '/terms', name: 'Terms of Service', component: Terms },
  { path: '/debug', name: 'Debug', component: Debug },
  { path: '/wordpacks', name: 'WordPacks', component: WordPacks },
  { path: '/wordpack/:wordListId(\\d+)', name: 'Wordpack', component: Home, props: true },
  {
    path: '/:gameId([a-zA-Z]{4})',
    name: 'Game',
    component: Game,
    // the game component reconnects fresh when the code changes
    props: (route) => ({
      connectedUsername: route.query.connectedUsername,
      summaryUrl: route.query.summaryUrl,
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
