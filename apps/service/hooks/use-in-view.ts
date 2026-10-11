import { useEffect, useState } from "react";

function scrollParent(node: Element) {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") return el;
  }
  return null;
}

/**
 * Whether the element is near view. With `once` (the default) it flips to true
 * the first time and then stays true.
 */
export function useInView<T extends Element>(
  rootMargin = "200px",
  { once = true } = {},
) {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  const settled = once && inView;

  useEffect(() => {
    if (!node || settled) return;

    // the margin only reaches past the edge of the element that scrolls
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[entries.length - 1].isIntersecting;
        if (visible || !once) setInView(visible);
      },
      { root: scrollParent(node), rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, settled, once, rootMargin]);

  return [setNode, inView] as const;
}
