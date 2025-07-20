import { Metadata } from "next";
import SignInForm from "../_components/sign-in-form";
import Info from "../_components/info";
import checkUser from "@/actions/auth/check-user";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Vaze",
  description: "Sign in | Vaze",
};

export default async function Page() {
  const { error } = await checkUser();

  if (error && error.status === 500) throw error;
  else if (error && error.status === 404) redirect("/register");

  return (
    <div className="flex h-screen">
      <Info />
      <SignInForm />
    </div>
  );
}
