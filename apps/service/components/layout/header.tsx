import logo from "@/assets/images/vaze.png";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "../theme-toggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between px-4 shadow-lg backdrop-blur-xl md:px-8">
      <Link href={"/"} className="flex items-center gap-1">
        <Image src={logo} alt="Vaze Logo" className="size-8 md:size-12" />
        <h1 className="text-lg font-bold md:text-2xl">Vaze</h1>
      </Link>
      <ThemeToggle />
    </header>
  );
}
