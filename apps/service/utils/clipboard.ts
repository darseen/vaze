/**
 * Copy text to the clipboard. Uses the async Clipboard API in secure contexts
 * and falls back to a hidden `<textarea>` + `execCommand("copy")` for non-HTTPS
 * self-hosted deployments. Returns whether the copy succeeded; callers own their
 * own UI feedback (toasts, "copied" state, etc.).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // fallback for non-secure contexts
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.prepend(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
    return true;
  } catch {
    return false;
  }
}
