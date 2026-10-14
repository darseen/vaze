import { listApiKeys } from "@/utils/api-keys";
import { authorize } from "@/utils/auth";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import GenerateKey from "./_components/generate-key";
import Header from "./_components/header";
import KeysList from "./_components/keys-list";

export const metadata: Metadata = {
  title: "API Key Management",
  description: "Vaze | Manage your API keys securely.",
};

export default async function Page() {
  await connection();
  // everything below will be excluded from prerendering

  const { user, error: authError } = await authorize("api-keys:manage");
  if (authError) redirect("/dashboard");

  const keys = listApiKeys(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Header />
      <GenerateKey />
      <KeysList keys={keys} />
    </div>
  );
}
