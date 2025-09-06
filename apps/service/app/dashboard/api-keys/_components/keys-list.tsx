"use client";

import { deleteApiKey } from "@/actions/api-keys/delete-key";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ApiKey } from "@/db";
import {
  AlertCircle,
  Calendar,
  Clock,
  Key,
  Shield,
  Timer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  keys: Omit<ApiKey, "key_hash" | "user_id">[];
}

export default function KeysList({ keys }: Props) {
  const deleteKey = async (keyId: string) => {
    try {
      const { error } = await deleteApiKey(keyId);
      if (error) return toast.error(error.message);

      toast.success("API key has been deleted.");
    } catch {
      toast.error("Something went wrong");
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return;

    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isKeyActive = (lastUsed?: string) => {
    if (!lastUsed) return false;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return new Date(lastUsed) >= oneDayAgo;
  };

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return new Date(expiryDate) <= oneWeekFromNow;
  };

  const activeKeysCount = keys.filter((key) =>
    isKeyActive(key.last_used),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-2xl font-bold tracking-tight">
            API Keys
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage your API keys and monitor their usage
          </p>
        </div>
        <Badge variant="outline" className="text-sm font-medium">
          {activeKeysCount} Active
        </Badge>
      </div>

      {keys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted mb-3 rounded-full p-3">
              <Key className="text-muted-foreground h-6 w-6" />
            </div>
            <h3 className="text-foreground mb-2 text-lg font-semibold">
              No API keys yet
            </h3>
            <p className="text-muted-foreground max-w-sm text-sm">
              Generate your first API key to start integrating with our
              services. Keys help you authenticate and track usage.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {keys.map((key) => {
            const keyIsActive = isKeyActive(key.last_used);
            return (
              <Card
                key={key.id}
                className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg"
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="absolute top-3 right-3 flex flex-wrap items-center gap-2">
                      <Badge
                        variant={keyIsActive ? "default" : "secondary"}
                        className={
                          keyIsActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                        }
                      >
                        <span
                          className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                            keyIsActive
                              ? "bg-green-600 dark:bg-green-400"
                              : "bg-zinc-400"
                          }`}
                        />
                        {keyIsActive ? "Active" : "Inactive"}
                      </Badge>

                      {key.expires_at && isExpiringSoon(key.expires_at) && (
                        <Badge
                          variant="destructive"
                          className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        >
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Expiring Soon
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-xl p-2.5 transition-colors duration-300 ${
                          keyIsActive
                            ? "bg-green-50 dark:bg-green-900/20"
                            : "bg-zinc-100 dark:bg-zinc-700"
                        }`}
                      >
                        <Shield
                          className={`h-5 w-5 transition-colors duration-300 sm:h-6 sm:w-6 ${
                            keyIsActive
                              ? "text-green-600 dark:text-green-400"
                              : "text-zinc-500 dark:text-zinc-400"
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="mb-2 text-base font-semibold sm:text-lg">
                          {key.name}
                        </h3>
                      </div>
                    </div>

                    {/* Delete button - desktop */}
                    <div className="hidden sm:block">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg p-2 text-zinc-400 transition-all duration-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Delete key</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                            <AlertDialogDescription className="text-pretty">
                              {`Are you sure you want to delete the key "
                              ${key.name}"? This action cannot be undone and will
                              immediately revoke access for any applications
                              using this key.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteKey(key.id)}
                              className="bg-red-600 text-white hover:bg-red-700"
                            >
                              Delete Key
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-700/50">
                      <Calendar className="size-5 text-zinc-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Created
                        </p>
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatDate(key.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-700/50">
                      <Clock className="size-5 text-zinc-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Last Used
                        </p>
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatDate(key.last_used) || "Never"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-700/50">
                      <Timer className="size-5 text-zinc-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Expires
                        </p>
                        <p
                          className={`truncate text-sm font-medium ${
                            key.expires_at && isExpiringSoon(key.expires_at)
                              ? "text-red-600 dark:text-red-400"
                              : "text-zinc-900 dark:text-zinc-100"
                          }`}
                        >
                          {formatDate(key.expires_at) || "Never"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mobile delete button */}
                  <div className="mt-4 pt-4 sm:hidden">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-center rounded-lg border transition-all duration-200"
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete Key
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                          <AlertDialogDescription className="text-pretty">
                            {` Are you sure you want to delete the key "${key.name}
                            "? This action cannot be undone and will immediately
                            revoke access for any applications using this key.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteKey(key.id)}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            Delete Key
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
