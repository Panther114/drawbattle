import { reactive, ref } from 'vue';

export const API = '/api';

// the one official pack
export const DEFAULT_WORD_LIST_ID = 110943;

// id -> metadata ({ id, name, numWords, sampleWords, description? })
export const packs = reactive({});
export const officialIds = ref([]);
export const globalIds = ref([]); // packs shared with everybody
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

// packs other players chose to share with everybody
export async function loadGlobalPacks() {
  try {
    const res = await fetch(`${API}/wordlists?type=global`);
    if (res.status !== 200) return;
    const list = await res.json();
    list.forEach((p) => {
      packs[p.id] = p;
    });
    globalIds.value = list.map((p) => p.id);
  } catch {
    // offline: the list stays as it was
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

// the full word list of the official pack, for cloning it in the editor
export async function fetchOfficialWords(id = DEFAULT_WORD_LIST_ID) {
  const res = await fetch(`${API}/wordlists/${id}/words`);
  if (res.status !== 200) throw new Error('could not load the official word pack');
  return res.json();
}

export function isStandardPack(id) {
  return id === DEFAULT_WORD_LIST_ID;
}
