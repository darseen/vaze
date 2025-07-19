import Link from "next/link";
import ThemeToggle from "../theme-toggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between px-8 shadow-lg backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Vaze</h1>
      </div>

      <div className="flex items-center gap-4">
        <Link href="#">About</Link>
        <Link href="#">Dashboard</Link>
        <Link href="#">Documentation</Link>
      </div>

      <ThemeToggle />
    </header>
  );
}
