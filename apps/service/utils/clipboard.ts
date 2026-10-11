/**
 * Copy text to the clipboard. Uses the async Clipboard API in secure contexts
 * and falls back to `execCommand("copy")` for non-HTTPS self-hosted
 * deployments. Returns whether the copy succeeded; callers own their own UI
 * feedback (toasts, "copied" state, etc.).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // select via a Range, not a focused textarea, so menu/dialog focus traps can't interfere
    const span = document.createElement("span");
    span.textContent = text;
    span.style.position = "fixed";
    span.style.top = "0";
    span.style.clip = "rect(0, 0, 0, 0)";
    span.style.whiteSpace = "pre";
    span.style.userSelect = "text";
    document.body.append(span);

    const selection = document.getSelection();
    const range = document.createRange();
    range.selectNodeContents(span);
    selection?.removeAllRanges();
    selection?.addRange(range);

    try {
      return document.execCommand("copy");
    } finally {
      selection?.removeAllRanges();
      span.remove();
    }
  } catch {
    return false;
  }
}
