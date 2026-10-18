import type {
  BaseLayoutProps,
  LinkItemType,
} from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import logo from "@/public/vaze.png";
import { appName, docsRoute, privacyRoute, repoUrl } from "./shared";

const docsLink: LinkItemType = {
  text: "Docs",
  url: docsRoute,
  active: "nested-url",
};
const privacyLink: LinkItemType = { text: "Privacy", url: privacyRoute };

// the docs sidebar is already the docs, so it leaves out its own link
export function baseOptions({ docs = true } = {}): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image src={logo} alt="" className="h-6 w-auto" />
          {appName}
        </>
      ),
    },
    links: docs ? [docsLink, privacyLink] : [privacyLink],
    githubUrl: repoUrl,
  };
}
