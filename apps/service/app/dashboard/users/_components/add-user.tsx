"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callApi } from "@/utils/api";
import type { UserSummary } from "@repo/types";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import AccessPicker, { type Access } from "./access-picker";
import PasswordInput from "./password-input";

const EMPTY = { name: "", email: "", password: "" };
const DEFAULT_ACCESS: Access = { role: "viewer", scopes: [] };

export default function AddUser() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(EMPTY);
  const [access, setAccess] = useState(DEFAULT_ACCESS);
  const [loading, setLoading] = useState(false);

  const update =
    (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((current) => ({ ...current, [field]: e.target.value }));

  const reset = () => {
    setFields(EMPTY);
    setAccess(DEFAULT_ACCESS);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (access.role === "custom" && access.scopes.length === 0) {
      return toast.error("Pick at least one scope for a custom role");
    }

    try {
      setLoading(true);
      const { error } = await callApi<{ user: UserSummary }>(
        "/api/users",
        "POST",
        { ...fields, ...access },
      );

      if (error) return toast.error(error.message);

      router.refresh();
      toast.success(`${fields.name.trim()} can now sign in`, {
        description:
          "Share their password with them. They can change it in Settings.",
      });
      reset();
      setOpen(false);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="shrink-0">
          <UserPlus />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            They sign in with this email and password. Their role decides what
            they can see and change.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-user-name">Name</Label>
              <Input
                id="new-user-name"
                value={fields.name}
                onChange={update("name")}
                autoComplete="off"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-email">Email</Label>
              <Input
                id="new-user-email"
                type="email"
                value={fields.email}
                onChange={update("email")}
                autoComplete="off"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-user-password">Password</Label>
            <PasswordInput
              id="new-user-password"
              value={fields.password}
              onChange={(password) =>
                setFields((current) => ({ ...current, password }))
              }
              disabled={loading}
            />
            <p className="text-muted-foreground text-sm">
              At least 8 characters.
            </p>
          </div>

          <AccessPicker
            idPrefix="new-user"
            value={access}
            onChange={setAccess}
            disabled={loading}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                !fields.name.trim() ||
                !fields.email.trim() ||
                !fields.password
              }
            >
              {loading ? "Adding..." : "Add user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
