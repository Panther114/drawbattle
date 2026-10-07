// Tiny tooltip directive: v-tooltip="'text'" or v-tooltip="{ content: 'html' }".
let tipEl;

function ensureTip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function show(el, value) {
  const tip = ensureTip();
  if (value && typeof value === 'object' && value.content !== undefined) tip.innerHTML = value.content;
  else tip.textContent = String(value);
  const r = el.getBoundingClientRect();
  tip.style.left = `${r.left + r.width / 2}px`;
  tip.style.top = `${r.top}px`;
  tip.classList.add('show');
}
function hide() {
  tipEl?.classList.remove('show');
}

export const tooltip = {
  mounted(el, binding) {
    el.__tip = binding.value;
    el.__tipEnter = () => show(el, el.__tip);
    el.addEventListener('mouseenter', el.__tipEnter);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('click', hide);
  },
  updated(el, binding) {
    el.__tip = binding.value;
  },
  beforeUnmount(el) {
    el.removeEventListener('mouseenter', el.__tipEnter);
    el.removeEventListener('mouseleave', hide);
    el.removeEventListener('click', hide);
    hide();
  },
};
