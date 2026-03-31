import checkUser from "@/actions/auth/check-user";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Info from "../_components/info";
import RegisterForm from "./_components/register-form";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a Vaze admin account",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const { error } = await checkUser();

  if (!error) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col-reverse lg:flex-row">
      <Info />
      <RegisterForm />
    </main>
  );
}
