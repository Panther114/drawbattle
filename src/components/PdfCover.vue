<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// A PDF drawn by the page itself (pdf.js) instead of the browser's own viewer or a frame: everything is in our
// document, so Quick Switch keys and mouse buttons keep working no matter how much you click or scroll here.
const props = defineProps({ src: { type: String, required: true }, open: { type: Boolean, default: false } });

const root = ref();
const pages = ref([]); // [{ n, w, h }] page sizes at scale 1
const failed = ref(false);
const GAP = 12;
let doc;
let pdfjs;
let observer;
let loadToken = 0;
const hosts = new Map(); // page number -> element
const drawn = new Map(); // page number -> width it was drawn for
const visible = new Set();
let resizeTimer;

const layoutTick = ref(0); // bumped on resize so the page boxes below re-measure
const columnWidth = () => {
  void layoutTick.value;
  return Math.min(1000, Math.max(200, (root.value?.clientWidth ?? window.innerWidth) - 24));
};
const heightFor = (p) => Math.round((columnWidth() * p.h) / p.w);

async function draw(n) {
  if (!doc || !hosts.has(n)) return;
  const width = columnWidth();
  if (drawn.get(n) === width) return;
  drawn.set(n, width);
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const scale = (width / base.width) * Math.min(2, window.devicePixelRatio || 1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const host = hosts.get(n);
  if (host && drawn.get(n) === width) host.replaceChildren(canvas);
}

function setHost(n, el) {
  if (!el) {
    hosts.delete(n);
    return;
  }
  hosts.set(n, el);
  el.dataset.page = String(n);
  observer?.observe(el);
}

async function load() {
  const token = ++loadToken;
  failed.value = false;
  pages.value = [];
  drawn.clear();
  visible.clear();
  try {
    // the viewer is a sizeable download: fetch it once the page has settled (at once if it is already wanted)
    if (!props.open) await new Promise((r) => (window.requestIdleCallback ? window.requestIdleCallback(r, { timeout: 4000 }) : setTimeout(r, 1500)));
    if (token !== loadToken) return;
    if (!pdfjs) {
      pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    }
    doc?.destroy();
    const d = await pdfjs.getDocument({ url: props.src }).promise;
    if (token !== loadToken) return d.destroy();
    doc = d;
    const sizes = [];
    for (let n = 1; n <= d.numPages; n++) {
      const v = (await d.getPage(n)).getViewport({ scale: 1 });
      sizes.push({ n, w: v.width, h: v.height });
    }
    if (token !== loadToken) return;
    pages.value = sizes;
  } catch {
    if (token === loadToken) failed.value = true;
  }
}

function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    layoutTick.value++;
    drawn.clear();
    for (const n of visible) void draw(n);
  }, 200);
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const n = Number(e.target.dataset.page);
        if (e.isIntersecting) {
          visible.add(n);
          void draw(n);
        } else visible.delete(n);
      }
    },
    { root: root.value, rootMargin: '600px 0px' },
  );
  window.addEventListener('resize', onResize);
  void load();
});
onBeforeUnmount(() => {
  loadToken++;
  observer?.disconnect();
  window.removeEventListener('resize', onResize);
  clearTimeout(resizeTimer);
  doc?.destroy();
});
watch(() => props.src, () => void load());
// the cover is laid out while hidden at first; draw again once it is really on screen
watch(
  () => props.open,
  async (o) => {
    if (!o) return;
    await nextTick();
    onResize();
    root.value?.focus({ preventScroll: true });
  },
);
</script>

<template>
  <div ref="root" class="qs-pdf" tabindex="-1">
    <div v-if="failed" class="qs-pdf-msg">this PDF could not be opened</div>
    <div
      v-for="p in pages"
      :key="p.n"
      :ref="(el) => setHost(p.n, el)"
      class="qs-pdf-page"
      :style="{ width: columnWidth() + 'px', height: heightFor(p) + 'px', marginBottom: GAP + 'px' }"
    />
  </div>
</template>
