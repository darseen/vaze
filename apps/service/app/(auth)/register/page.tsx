import { Metadata } from "next";
import RegisterForm from "./_components/register-form";
import Info from "./_components/info";
import checkUser from "@/actions/auth/check-user";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Vaze",
  description: "Register | Vaze",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const { error } = await checkUser();

  if (!error) redirect("/");

  return (
    <main className="flex min-h-screen">
      <Info />
      <RegisterForm />
    </main>
  );
}
