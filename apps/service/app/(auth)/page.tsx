import checkUser from "@/actions/auth/check-user";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import Info from "../_components/info";
import SignInForm from "../_components/sign-in-form";

export const metadata: Metadata = {
  title: "Vaze",
  description: "Sign in | Vaze",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const { error, status } = await checkUser();

  if (error && status === 404) redirect("/register");
  else if (error && status === 500) throw error;

  return (
    <div className="flex h-screen">
      <Info />
      <SignInForm />
    </div>
  );
}
