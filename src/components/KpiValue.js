import { useLayoutEffect, useRef } from 'react';

export default function KpiValue({ children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      el.style.fontSize = '';
      const computed = parseFloat(window.getComputedStyle(el).fontSize) || 26;
      if (el.scrollWidth <= el.clientWidth + 1) return;
      let lo = 10;
      let hi = Math.floor(computed);
      let best = 10;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        el.style.fontSize = `${mid}px`;
        if (el.scrollWidth <= el.clientWidth + 1) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      el.style.fontSize = `${best}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    const parent = el.parentElement;
    if (typeof ResizeObserver === 'undefined' || !parent) {
      return () => window.removeEventListener('resize', fit);
    }
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    return () => {
      window.removeEventListener('resize', fit);
      ro.disconnect();
    };
  }, [children]);
  return <div ref={ref} className="dashboard-kpi-value">{children}</div>;
}
