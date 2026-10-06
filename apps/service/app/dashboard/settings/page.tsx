import { Settings } from "lucide-react";
import { Metadata } from "next";
import { connection } from "next/server";
import { ReactNode } from "react";
import DefaultVisibility from "./_components/default-visibility";
import LimitsForm from "./_components/limits-form";
import PasswordForm from "./_components/password-form";
import ProfileForm from "./_components/profile-form";
import SessionsList from "./_components/sessions-list";
import fetchSettings from "./_utils/fetch-settings";

export const metadata: Metadata = {
  title: "Settings",
  description: "Vaze | Manage your account and how your instance behaves.",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-foreground text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default async function Page() {
  await connection();
  // everything below will be excluded from prerendering

  const { data, error } = await fetchSettings();

  if (error) throw error;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Settings className="text-primary h-8 w-8" />
          <h1 className="text-foreground text-3xl font-bold">Settings</h1>
        </div>
        <p className="text-muted-foreground text-balance">
          Manage your account and how your Vaze instance handles files.
        </p>
      </div>

      <div className="space-y-10">
        <Section
          title="Account"
          description="Your sign-in details and the devices using them."
        >
          <ProfileForm {...data.profile} />
          <PasswordForm email={data.profile.email} />
          <SessionsList sessions={data.sessions} />
        </Section>

        <Section
          title="Files"
          description="Defaults for files and folders you create."
        >
          <DefaultVisibility
            visibility={data.defaultVisibility}
            counts={data.visibilityCounts}
          />
        </Section>

        <Section
          title="Limits"
          description="Upload size, signed links, caching and how long history is kept."
        >
          <LimitsForm limits={data.limits} />
        </Section>
      </div>
    </div>
  );
}
