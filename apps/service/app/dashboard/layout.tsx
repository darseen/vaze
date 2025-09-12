import { ReactNode } from "react";
import Header from "./_components/header";

export default function DashboardLayout({
  children,
}: {
  children: Readonly<ReactNode>;
}) {
  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-6">{children}</div>
    </>
  );
}
