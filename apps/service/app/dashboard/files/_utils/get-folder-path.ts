/** Turn a `/dashboard/files/...` pathname into the folder key it points at. */
export default function getFolderPath(pathname: string) {
  return pathname
    .replace(/^\/dashboard\/files\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}
