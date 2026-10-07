<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';
import { Op } from '../shared.js';

const props = defineProps({
  teamIndex: { type: Number },
  isDrawer: { type: Boolean, default: false },
  canDrawerDraw: { type: Boolean, default: true },
  canvasOperations: Array,
  hideContent: { type: Boolean, default: false },
  blur: { type: Boolean, default: false },
  drawerTool: { type: String, default: 'pencil' },
  drawerColor: { type: String },
  drawerStrokeWidth: { type: Number },
  didGuessWord: { type: Boolean, default: false },
  isOtherTeam: { type: Boolean, default: false },
  showStartDrawingMessage: { type: Boolean, default: false },
});
const emit = defineEmits(['path-start', 'path-move', 'path-end', 'canvas-dimensions']);

// stroke width setting -> fraction of canvas width
const WIDTH_FRACTIONS = { 1: 0.01, 2: 0.02, 3: 0.05, 4: 0.1 };
// blurred (other team) canvases are drawn at this tiny resolution then scaled up
const BLUR_W = 24;
const BLUR_H = 16;

const containerEl = ref();
const canvasEl = ref();
const blurEl = ref();
const drawEl = ref(); // the element receiving pointer events

const width = ref(0);
const height = computed(() => width.value / 1.5);
const color = ref(props.drawerColor ?? '000000');
const tool = ref(props.drawerTool);
const strokeWidth = ref(props.drawerStrokeWidth ?? 1);
const effectiveColor = computed(() => (tool.value === 'eraser' ? 'ffffff' : color.value));
const lineWidth = computed(() => Math.ceil(width.value * WIDTH_FRACTIONS[strokeWidth.value]));
const hasDrawn = ref(false);
const cursorX = ref();
const cursorY = ref();
const lastX = ref();
const lastY = ref();
const replayTimer = ref();

const ctx = () => (drawEl.value ? drawEl.value.getContext('2d') : null);
const disabled = computed(() => !props.isDrawer || !props.canDrawerDraw);

const norm = (v) => Number((v / width.value).toFixed(3));
const toPx = (v) => (props.blur ? Math.floor(BLUR_W * v) : Math.floor(v * width.value));

function paintBlur() {
  const c = canvasEl.value.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(blurEl.value, 0, 0, BLUR_W, BLUR_H, 0, 0, width.value, height.value);
}

function setColor(c) {
  color.value = c;
  if (tool.value === 'pencil') ctx().strokeStyle = `#${c}`;
}
function setTool(t) {
  tool.value = t;
  ctx().strokeStyle = `#${effectiveColor.value}`;
}
function setStrokeWidth(w) {
  strokeWidth.value = w;
}
function clearCanvas(reset) {
  canvasEl.value.getContext('2d').clearRect(0, 0, width.value, height.value);
  if (props.blur) ctx().clearRect(0, 0, BLUR_W, BLUR_H);
  if (reset === true) hasDrawn.value = false;
}
function resetDrawer() {
  tool.value = 'pencil';
  setColor('000000');
  setStrokeWidth(1);
}
function resetCanvas() {
  clearCanvas();
  resetDrawer();
}

function pathStart(x, y) {
  const c = ctx();
  c.lineWidth = props.blur ? 1 : lineWidth.value;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(toPx(x), toPx(y));
  c.lineTo(toPx(x), toPx(y));
  c.stroke();
  if (props.blur) paintBlur();
  hasDrawn.value = true;
}
function pathMove(x, y) {
  const c = ctx();
  c.lineTo(toPx(x), toPx(y));
  c.stroke();
  if (props.blur) paintBlur();
}

function localStart(px, py) {
  lastX.value = norm(px);
  lastY.value = norm(py);
  pathStart(lastX.value, lastY.value);
  emit('path-start', [lastX.value, lastY.value]);
  document.body.style.userSelect = 'none';
}
function localMove(px, py) {
  lastX.value = norm(px);
  lastY.value = norm(py);
  pathMove(lastX.value, lastY.value);
  emit('path-move', [lastX.value, lastY.value]);
}
function localEnd() {
  emit('path-end');
  document.body.style.userSelect = '';
}

// trailing throttle: keep the latest args, fire at most once per `ms`
function throttle(fn, ms) {
  let timer;
  let args;
  const t = (...a) => {
    args = a;
    if (timer === undefined) {
      timer = window.setTimeout(() => {
        fn(...args);
        timer = undefined;
      }, ms);
    }
  };
  t.cancel = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };
  return t;
}

const onMouseMove = throttle((e) => {
  const r = canvasEl.value.getBoundingClientRect();
  localMove(e.clientX - r.x, e.clientY - r.y);
}, 30);
function onMouseUp() {
  drawEl.value.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  localEnd();
}
function onMouseDown(e) {
  drawEl.value.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  const r = canvasEl.value.getBoundingClientRect();
  localStart(e.clientX - r.x, e.clientY - r.y);
}
const onTouchMove = throttle((e) => {
  const t = e.touches[0];
  const r = canvasEl.value.getBoundingClientRect();
  localMove(t.clientX - r.x, t.clientY - r.y);
}, 20);
function blockTouch(e) {
  e.preventDefault();
}
function onTouchEnd() {
  drawEl.value.removeEventListener('touchmove', onTouchMove);
  window.removeEventListener('touchend', onTouchEnd);
  window.removeEventListener('touchstart', blockTouch);
  localEnd();
}
function onTouchStart(e) {
  if (e.touches.length !== 1) return;
  drawEl.value.addEventListener('touchmove', onTouchMove);
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('touchstart', blockTouch, { passive: false });
  const t = e.touches[0];
  const r = drawEl.value.getBoundingClientRect();
  localStart(t.clientX - r.x, t.clientY - r.y);
  e.preventDefault();
}
const onMouseOver = (e) => {
  cursorX.value = e.offsetX;
  cursorY.value = e.offsetY;
};
const onMouseOut = () => {
  cursorX.value = undefined;
  cursorY.value = undefined;
};
function onResize() {
  width.value = containerEl.value.offsetWidth;
}

// apply one canvas operation (from the network or a replay)
function processOperation(op) {
  switch (op[0]) {
    case Op.PathStart:
      pathStart(op[1][0], op[1][1]);
      break;
    case Op.PathMove:
      pathMove(op[1][0], op[1][1]);
      break;
    case Op.PathEnd:
      break;
    case Op.ChangeColor:
      setColor(op[1]);
      break;
    case Op.ChangeTool:
      setTool(op[1]);
      break;
    case Op.ChangeStrokeWidth:
      setStrokeWidth(op[1]);
      break;
    case Op.ClearCanvas:
      clearCanvas();
      break;
  }
}

function replayDrawing() {
  if (replayTimer.value !== undefined) {
    clearTimeout(replayTimer.value);
    replayTimer.value = undefined;
  }
  const ops = props.canvasOperations;
  if (ops !== undefined && ops.length > 0) {
    resetCanvas();
    let i = 0;
    const step = () => {
      processOperation(ops[i]);
      i++;
      replayTimer.value = i < ops.length ? setTimeout(step, 10) : undefined;
    };
    step();
  }
}

function detach() {
  const el = drawEl.value;
  if (!el) return;
  el.removeEventListener('mousedown', onMouseDown);
  el.removeEventListener('mousemove', onMouseMove);
  onMouseMove.cancel();
  window.removeEventListener('mouseup', onMouseUp);
  el.removeEventListener('mouseover', onMouseOver);
  el.removeEventListener('mousemove', onCursorMove);
  el.removeEventListener('mouseout', onMouseOut);
  el.removeEventListener('touchstart', onTouchStart);
  el.removeEventListener('touchmove', onTouchMove);
  onTouchMove.cancel();
  window.removeEventListener('touchend', onTouchEnd);
  window.removeEventListener('touchstart', blockTouch);
}
const onCursorMove = onMouseOver;

function attach() {
  const el = drawEl.value;
  el.addEventListener('mousedown', onMouseDown);
  el.addEventListener('mouseover', onMouseOver);
  el.addEventListener('mousemove', onCursorMove);
  el.addEventListener('mouseout', onMouseOut);
  el.addEventListener('touchstart', onTouchStart);
}

defineExpose({
  onClearClick: () => {
    if (!disabled.value) clearCanvas();
  },
  processOperation,
  replayDrawing,
  clearCanvas,
  resetDrawer,
  resetCanvas,
});

watch(width, () => {
  const c = canvasEl.value;
  c.width = width.value;
  c.height = height.value;
  if (props.canvasOperations !== undefined) {
    resetCanvas();
    for (const op of props.canvasOperations) processOperation(op);
  }
  emit('canvas-dimensions', { height: height.value, width: width.value });
});
watch(
  () => props.canvasOperations,
  (ops, old) => {
    if (ops !== undefined && old === undefined) {
      resetCanvas();
      for (const op of ops) processOperation(op);
    }
  },
);

onMounted(() => {
  width.value = containerEl.value.offsetWidth;
  const c = canvasEl.value;
  c.width = width.value;
  c.height = height.value;
  if (props.blur) {
    blurEl.value.width = BLUR_W;
    blurEl.value.height = BLUR_H;
    drawEl.value = blurEl.value;
  } else {
    drawEl.value = c;
  }
  ctx().strokeStyle = `#${color.value}`;
  window.addEventListener('resize', onResize);
  watchEffect(() => {
    if (!drawEl.value) return;
    if (disabled.value) detach();
    else {
      detach();
      attach();
    }
  });
  watch(
    () => props.drawerTool,
    (t) => setTool(t),
  );
  watch(
    () => props.drawerColor,
    (c2) => {
      if (c2 !== undefined) setColor(c2);
    },
  );
  watch(
    () => props.drawerStrokeWidth,
    (w) => {
      if (w !== undefined) setStrokeWidth(w);
    },
  );
  if (props.canvasOperations !== undefined) for (const op of props.canvasOperations) processOperation(op);
});
onBeforeUnmount(() => {
  detach();
  window.removeEventListener('resize', onResize);
  if (replayTimer.value !== undefined) clearTimeout(replayTimer.value);
  document.body.style.userSelect = '';
});

// hand-drawn canvas outline (514 x 344 box)
const OUTLINE =
  'M13 6C100 3 250 8 385 5C440 3.5 480 3.5 503 4C509 4.2 511.5 7 510.5 13C509.5 90 512.5 195 510.5 292C510 322 509 338 503 340C380 342 252 337 130 341C75 342.5 35 340 14 340.5C6.5 340.5 4 337 4 330C3.5 240 6 120 4.5 14C4.2 8 7 6 13 6Z';
</script>

<template>
  <div class="dc-root">
    <div :style="{ paddingTop: 100 / 1.5 + '%' }" />
    <div ref="containerEl" class="dc-container" :style="{ height: height + 'px' }">
      <canvas
        ref="canvasEl"
        :style="{ width: width + 'px', height: height + 'px' }"
        class="dc-canvas"
        :class="{ hidden: hideContent, drawer: !disabled }"
      />
      <canvas v-if="blur" ref="blurEl" class="dc-blur" />
      <div v-if="showStartDrawingMessage && !hasDrawn" class="dc-start-message">start drawing!</div>
      <slot />
      <div
        v-if="!disabled"
        class="dc-cursor"
        :class="{ white: effectiveColor === 'ffffff' }"
        :style="{
          display: cursorX !== undefined && cursorY !== undefined ? 'block' : 'none',
          width: lineWidth + 'px',
          height: lineWidth + 'px',
          backgroundColor: '#' + effectiveColor,
          transform: `translate(${(cursorX || 0) - lineWidth / 2}px, ${(cursorY || 0) - lineWidth / 2}px)`,
        }"
      />
    </div>
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 514 344"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      class="dc-border"
    >
      <path
        :d="OUTLINE"
        fill="none"
        vector-effect="non-scaling-stroke"
        :stroke="didGuessWord ? '#219650' : '#c0c0c0'"
        :stroke-width="isOtherTeam ? 2 : 4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <clipPath id="canvas-clip" clipPathUnits="objectBoundingBox" transform="scale(0.001945 0.0029)">
        <path :d="OUTLINE" />
      </clipPath>
    </svg>
  </div>
</template>
