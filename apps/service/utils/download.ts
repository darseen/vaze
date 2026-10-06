let frameCount = 0;

/** One file downloads as itself; several stream to disk as a zip. */
export function downloadFiles(ids: string[], onError: () => void) {
  if (ids.length === 0) return;

  if (ids.length === 1) {
    const link = document.createElement("a");
    link.href = `/api/files/download/${ids[0]}`;
    link.download = "";
    link.click();
    return;
  }

  // a hidden frame, so the response never navigates the dashboard away
  const name = `download-frame-${++frameCount}`;
  const frame = document.createElement("iframe");
  frame.name = name;
  frame.hidden = true;
  document.body.append(frame);

  // a download never renders, so a document loading here is an error response
  frame.addEventListener("load", () => {
    try {
      if (frame.contentWindow?.location.href === "about:blank") return;
    } catch {
      // X-Frame-Options leaves the error page opaque, so its message is unreadable
    }
    onError();
    frame.remove();
  });

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/files/download";
  form.target = name;
  form.hidden = true;

  for (const id of ids) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "ids";
    input.value = id;
    form.append(input);
  }

  document.body.append(form);
  form.submit();
  form.remove();

  // the download outlives the frame once it has started
  setTimeout(() => frame.remove(), 60_000);
}
