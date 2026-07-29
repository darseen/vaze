import { Metadata } from "next";
import { connection } from "next/server";
import GenerateKey from "./_components/generate-key";
import Header from "./_components/header";
import KeysList from "./_components/keys-list";
import fetchKeys from "./_utils/fetch-keys";

export const metadata: Metadata = {
  title: "API Key Management",
  description: "Vaze | Manage your API keys securely.",
};

export default async function Page() {
  await connection();
  // everything below will be excluded from prerendering

  const { data, error } = await fetchKeys();

  if (error) throw error;

  const { keys } = data;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Header />
      <GenerateKey />
      <KeysList keys={keys} />
    </div>
  );
}
