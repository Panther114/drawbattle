// Word packs created or imported in the browser (kept in localStorage), plus import/export helpers.
import { reactive } from 'vue';
import { API } from './wordpacks.js';
import { safeStorage } from './storage.js';

const KEY = 'dbWordPacks';
const storage = safeStorage('local');

function load() {
  try {
    const v = JSON.parse(storage?.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((p) => p && typeof p.name === 'string' && Array.isArray(p.words)) : [];
  } catch {
    return [];
  }
}

export const localPacks = reactive(load());

function save() {
  try {
    storage?.setItem(KEY, JSON.stringify(localPacks));
  } catch {
    // storage full or blocked: packs stay in memory for this session
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function cleanWords(words) {
  const seen = new Set();
  const out = [];
  for (const raw of words) {
    const w = String(raw).trim().replace(/\s+/g, ' ').slice(0, 40);
    const k = w.toLowerCase();
    if (w && !seen.has(k)) {
      seen.add(k);
      out.push(w);
    }
  }
  return out;
}

export function createPack(init = {}) {
  const pack = { uid: uid(), name: init.name || 'new word pack', description: init.description || '', words: cleanWords(init.words || []) };
  localPacks.unshift(pack);
  save();
  return pack;
}
export function savePacks() {
  save();
}
export function deletePack(p) {
  const i = localPacks.findIndex((x) => x.uid === p.uid);
  if (i >= 0) localPacks.splice(i, 1);
  save();
}

// ---- parsing imported files ----
const TEXT_EXT = /\.(txt|csv|tsv|json|md|list|words)$/i;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILES = 200;

function baseName(path) {
  const file = path.split('/').pop() || path;
  return file.replace(/\.[^.]+$/, '');
}

function parseText(text, ext) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const words = [];
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    if (ext === 'csv' || ext === 'tsv') line = line.split(ext === 'csv' ? ',' : '\t')[0];
    line = line.replace(/^["']|["']$/g, '').trim();
    if (/^(word|words)$/i.test(line) && words.length === 0) continue; // header row
    words.push(line);
  }
  // a single comma/semicolon separated line
  if (words.length === 1 && /[,;]/.test(words[0]) && ext !== 'csv') return words[0].split(/[,;]/);
  return words;
}

function packsFromJson(value, fallbackName) {
  if (Array.isArray(value)) {
    if (value.every((x) => typeof x === 'string')) return [{ name: fallbackName, words: value }];
    return value.flatMap((x) => packsFromJson(x, fallbackName));
  }
  if (value && typeof value === 'object') {
    const words = value.words || value.wordList || value.list;
    if (Array.isArray(words)) {
      return [{ name: value.name || value.title || fallbackName, description: value.description || '', words: words.map((w) => (typeof w === 'string' ? w : w && w.word)).filter(Boolean) }];
    }
  }
  return [];
}

// files: FileList / File[] (from a directory picker, files carry webkitRelativePath)
export async function parseFiles(files) {
  const list = [...files].filter((f) => !f.name.startsWith('.') && TEXT_EXT.test(f.name)).slice(0, MAX_FILES);
  const skipped = [...files].length - list.length;
  const results = [];
  const errors = [];
  for (const f of list) {
    if (f.size > MAX_FILE_BYTES) {
      errors.push(`${f.name}: file is too large`);
      continue;
    }
    const rel = f.webkitRelativePath || f.name;
    const parts = rel.split('/');
    const dir = parts.length > 1 ? parts[parts.length - 2] : undefined;
    let name = baseName(rel);
    if (dir && /^(words?|index|wordlist|list)$/i.test(name)) name = dir;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    try {
      const text = await f.text();
      if (ext === 'json') {
        const packs = packsFromJson(JSON.parse(text), name);
        if (packs.length === 0) errors.push(`${f.name}: no word list found`);
        results.push(...packs);
      } else {
        results.push({ name, words: parseText(text, ext) });
      }
    } catch (e) {
      errors.push(`${f.name}: ${e.message}`);
    }
  }
  const packs = results
    .map((p) => ({ ...p, words: cleanWords(p.words) }))
    .filter((p) => p.words.length > 0);
  return { packs, errors, skipped };
}

export function exportPack(p, format = 'json') {
  const body =
    format === 'json'
      ? JSON.stringify({ name: p.name, description: p.description, words: p.words }, null, 2)
      : p.words.join('\n') + '\n';
  const blob = new Blob([body], { type: format === 'json' ? 'application/json' : 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${p.name.replace(/[^\w-]+/g, '_') || 'wordpack'}.${format === 'json' ? 'json' : 'txt'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// share a pack with every player: it is uploaded, then listed under "community" in everyone's pack browser
export async function sharePack(p) {
  const meta = await uploadPack(p);
  const res = await fetch(`${API}/wordpacks/${meta.id}/share`, { method: 'POST' });
  if (res.status !== 200) throw new Error((await res.text()) || 'could not share the word pack');
  return res.json();
}

// upload a pack to the server so it can be used in a game; resolves to the pack's server metadata
export async function uploadPack(p) {
  const res = await fetch(`${API}/wordpacks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: p.name, description: p.description, words: p.words }),
  });
  if (res.status !== 200) throw new Error((await res.text()) || 'could not upload word pack');
  return res.json();
}
