import { auth } from "@/lib/auth";
import { hasScope } from "@/lib/permissions";
import { listSessions } from "@/lib/sessions";
import { getInstanceSettings } from "@/lib/settings";
import { Settings } from "lucide-react";
import { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ReactNode } from "react";
import DefaultVisibility from "./_components/default-visibility";
import LimitsForm from "./_components/limits-form";
import PasswordForm from "./_components/password-form";
import ProfileForm from "./_components/profile-form";
import SessionsList from "./_components/sessions-list";

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

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const { user } = session;
  const instance = hasScope(user, "settings:manage")
    ? getInstanceSettings()
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Settings className="text-primary h-8 w-8" />
          <h1 className="text-foreground text-3xl font-bold">Settings</h1>
        </div>
        <p className="text-muted-foreground text-balance">
          {instance
            ? "Manage your account and how your Vaze instance handles files."
            : "Manage your account and the devices signed in to it."}
        </p>
      </div>

      <div className="space-y-10">
        <Section
          title="Account"
          description="Your sign-in details and the devices using them."
        >
          <ProfileForm name={user.name} email={user.email} />
          <PasswordForm email={user.email} />
          <SessionsList sessions={listSessions(user.id, session.session.id)} />
        </Section>

        {instance && (
          <>
            <Section
              title="Files"
              description="Defaults for files and folders you create."
            >
              <DefaultVisibility
                visibility={instance.defaultVisibility}
                counts={instance.visibilityCounts}
              />
            </Section>

            <Section
              title="Limits"
              description="Upload size, signed links, caching and how long history is kept."
            >
              <LimitsForm limits={instance.limits} />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
