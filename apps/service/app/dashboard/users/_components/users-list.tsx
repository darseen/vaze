"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ALL_SCOPES, ROLE_INFO, SCOPE_INFO } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils";
import { callApi } from "@/utils/api";
import type { Role, UserSummary } from "@repo/types";
import {
  LockKeyhole,
  MoreVertical,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EditAccessDialog, ResetPasswordDialog } from "./user-dialogs";

const ROLE_TONES: Record<Role, string> = {
  admin:
    "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-300",
  editor:
    "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/30 dark:text-blue-300",
  viewer:
    "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  custom:
    "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-900/50 dark:bg-violet-900/30 dark:text-violet-300",
};

type Pending = {
  kind: "access" | "password" | "disable" | "delete";
  user: UserSummary;
} | null;

interface Props {
  users: UserSummary[];
  currentUserId: string;
}

export default function UsersList({ users, currentUserId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [loading, setLoading] = useState(false);

  const close = () => setPending(null);

  const handleSetDisabled = async (user: UserSummary, disabled: boolean) => {
    try {
      setLoading(true);
      const { error } = await callApi<{ user: UserSummary }>(
        "/api/users",
        "PUT",
        { id: user.id, disabled },
      );

      if (error) return toast.error(error.message);

      router.refresh();
      toast.success(
        disabled
          ? `${user.name} is disabled`
          : `${user.name} can sign in again`,
      );
      close();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (user: UserSummary) => {
    try {
      setLoading(true);
      const { error } = await callApi<null>("/api/users", "DELETE", {
        id: user.id,
      });

      if (error) return toast.error(error.message);

      router.refresh();
      toast.success(`${user.name} was deleted`);
      close();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-2xl font-bold tracking-tight">
            Accounts
          </h2>
          <p className="text-muted-foreground mt-1">
            Everyone who can sign in to this instance.
          </p>
        </div>
        <Badge variant="outline" className="text-sm font-medium">
          {users.length} {users.length === 1 ? "user" : "users"}
        </Badge>
      </div>

      <div className="grid gap-3">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          const hasEverything = user.scopes.length === ALL_SCOPES.length;

          return (
            <Card
              key={user.id}
              className={cn(
                "py-0",
                user.disabled && "bg-muted/40 border-dashed",
              )}
            >
              <CardContent className="flex items-start gap-4 p-4 sm:p-5">
                <Avatar className="size-10 rounded-lg">
                  <AvatarFallback className="from-primary/15 to-primary/5 text-foreground rounded-lg bg-gradient-to-br text-sm font-semibold">
                    {user.name[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        <span className="truncate">{user.name}</span>
                        {isSelf && <Badge variant="secondary">You</Badge>}
                        {user.disabled && (
                          <Badge variant="outline" className="text-red-600">
                            Disabled
                          </Badge>
                        )}
                      </p>
                      <p className="text-muted-foreground truncate text-sm">
                        {user.email}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", ROLE_TONES[user.role])}
                    >
                      {ROLE_INFO[user.role].label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {hasEverything ? (
                      <Badge variant="outline" className="font-normal">
                        Every scope
                      </Badge>
                    ) : user.scopes.length === 0 ? (
                      <span className="text-muted-foreground text-xs">
                        No scopes
                      </span>
                    ) : (
                      user.scopes.map((scope) => (
                        <Badge
                          key={scope}
                          variant="outline"
                          className="font-normal"
                          title={scope}
                        >
                          {SCOPE_INFO[scope].label}
                        </Badge>
                      ))
                    )}
                  </div>

                  <p className="text-muted-foreground text-xs">
                    Added {formatDate(user.createdAt)} · {user.apiKeys}{" "}
                    {user.apiKeys === 1 ? "API key" : "API keys"}
                  </p>
                </div>

                {!isSelf && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mt-1 -mr-2 shrink-0"
                        aria-label={`Manage ${user.name}`}
                      >
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem
                        onClick={() => setPending({ kind: "access", user })}
                        className="cursor-pointer"
                      >
                        <UserCog className="mr-3 h-4 w-4" />
                        Change access
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setPending({ kind: "password", user })}
                        className="cursor-pointer"
                      >
                        <LockKeyhole className="mr-3 h-4 w-4" />
                        Reset password
                      </DropdownMenuItem>
                      {user.disabled ? (
                        <DropdownMenuItem
                          onClick={() => handleSetDisabled(user, false)}
                          disabled={loading}
                          className="cursor-pointer"
                        >
                          <UserCheck className="mr-3 h-4 w-4" />
                          Enable
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => setPending({ kind: "disable", user })}
                          className="cursor-pointer"
                        >
                          <UserX className="mr-3 h-4 w-4" />
                          Disable
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setPending({ kind: "delete", user })}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="mr-3 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {pending?.kind === "access" && (
        <EditAccessDialog user={pending.user} onClose={close} />
      )}

      {pending?.kind === "password" && (
        <ResetPasswordDialog user={pending.user} onClose={close} />
      )}

      <AlertDialog
        open={pending?.kind === "disable"}
        onOpenChange={(open) => !open && close()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable {pending?.user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be signed out everywhere and their API keys stop
              working until you enable them again. Nothing is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                if (pending) handleSetDisabled(pending.user, true);
              }}
            >
              {loading ? "Disabling..." : "Disable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pending?.kind === "delete"}
        onOpenChange={(open) => !open && close()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pending?.user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their account, API keys and activity history are removed for good.
              Files they uploaded stay where they are. To only block access,
              disable them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                if (pending) handleDelete(pending.user);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Deleting..." : "Delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
