import { authorize } from "@/utils/auth";
import { Users } from "lucide-react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AddUser from "./_components/add-user";
import UsersList from "./_components/users-list";
import fetchUsers from "./_utils/fetch-users";

export const metadata: Metadata = {
  title: "Users",
  description: "Vaze | Add people and choose what each of them can do.",
};

export default async function Page() {
  await connection();
  // everything below will be excluded from prerendering

  const { user, error: authError } = await authorize("users:manage");
  if (authError) redirect("/dashboard");

  const { data, error } = fetchUsers();

  if (error) throw error;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Users className="text-primary h-8 w-8" />
            <h1 className="text-foreground text-3xl font-bold">Users</h1>
          </div>
          <p className="text-muted-foreground text-balance">
            Add people to this instance and choose what each of them can do.
            Files are shared; roles and scopes decide who can see and change
            them.
          </p>
        </div>
        <AddUser />
      </div>

      <UsersList users={data.users} currentUserId={user.id} />
    </div>
  );
}
