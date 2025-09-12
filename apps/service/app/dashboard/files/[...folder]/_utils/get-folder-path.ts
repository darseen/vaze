export default function getFolderPath(pathname: string) {
  return pathname.replace("/dashboard/files/uploads", "");
}
