import checkUser from "@/actions/auth/check-user";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import Info from "./_components/info";
import SignInForm from "./_components/sign-in-form";

export const metadata: Metadata = {
  title: "Auth",
  description: "Sign in to your Vaze account",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const { error, status } = await checkUser();

  if (error && status === 404) redirect("/register");
  else if (error && status === 500) throw error;

  return (
    <main className="flex min-h-screen flex-col-reverse lg:flex-row">
      <Info />
      <SignInForm />
    </main>
  );
}
