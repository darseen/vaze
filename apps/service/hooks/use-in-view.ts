import { useEffect, useState } from "react";

function scrollParent(node: Element) {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") return el;
  }
  return null;
}

/** Flips to true the first time the element nears view, then stays true. */
export function useInView<T extends Element>(rootMargin = "200px") {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!node || inView) return;

    // the margin only reaches past the edge of the element that scrolls
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setInView(true);
      },
      { root: scrollParent(node), rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, inView, rootMargin]);

  return [setNode, inView] as const;
}
