// Scroll reveal: every [data-reveal] element under the given root gets the class `is-in` the first time it scrolls into
// view (the styles in home.css do the rest). One shared observer, dropped again when the page goes away.
import { onMounted, onUnmounted } from 'vue';

export function useReveal(rootRef) {
  let io;
  onMounted(() => {
    const els = rootRef.value?.querySelectorAll('[data-reveal]') ?? [];
    if (!('IntersectionObserver' in window)) return els.forEach((el) => el.classList.add('is-in'));
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    els.forEach((el) => io.observe(el));
  });
  onUnmounted(() => io?.disconnect());
}
