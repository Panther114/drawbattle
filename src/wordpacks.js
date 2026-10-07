import { reactive, ref } from 'vue';

export const API = '/api';

export const DEFAULT_WORD_LIST_ID = 110943;
// the standard pack, plus the pack for the current year's special edition
export const SPECIAL_WORD_LIST_ID = 775386;

// id -> metadata ({ id, name, numWords, sampleWords, description?, authorName? })
export const packs = reactive({});
export const officialIds = ref([]);
export const communityIds = ref(undefined);
const inflight = {};

export async function loadOfficialPacks() {
  try {
    const res = await fetch(`${API}/wordlists?type=official`);
    if (res.status !== 200) return;
    const list = await res.json();
    list.forEach((p) => {
      packs[p.id] = p;
    });
    officialIds.value = list.map((p) => p.id);
  } catch {
    // offline: lists stay empty
  }
}

export async function loadPack(id) {
  if (packs[id] !== undefined || inflight[id] !== undefined) return;
  inflight[id] = true;
  try {
    const res = await fetch(`${API}/wordlists/${id}`, { method: 'GET' });
    if (res.status === 200) packs[id] = await res.json();
  } finally {
    delete inflight[id];
  }
}

export async function loadCommunityPacks() {
  if (communityIds.value !== undefined) return;
  const res = await fetch(`${API}/wordlists?type=community`, { method: 'GET' });
  if (res.status === 200) {
    const list = await res.json();
    list.forEach((p) => {
      packs[p.id] = p;
    });
    communityIds.value = list.map((p) => p.id);
  }
}

export function isStandardPack(id) {
  return id === DEFAULT_WORD_LIST_ID || id === SPECIAL_WORD_LIST_ID;
}
