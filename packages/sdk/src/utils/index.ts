import type { FileWithUrl } from "@repo/types";

export function constructFileUrls({
  vazeUrl,
  files,
}: {
  vazeUrl: string;
  files: FileWithUrl[];
}) {
  return files.map((file) => ({
    ...file,
    url: `${vazeUrl}/${file.url}`,
  }));
}
