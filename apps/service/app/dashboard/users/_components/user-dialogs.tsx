"use client";

import resetPassword from "@/actions/users/reset-password";
import updateAccess from "@/actions/users/update-access";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import type { UserRow } from "../_utils/fetch-users";
import AccessPicker, { type Access } from "./access-picker";
import PasswordInput from "./password-input";

interface Props {
  user: UserRow;
  onClose: () => void;
}

export function EditAccessDialog({ user, onClose }: Props) {
  const [access, setAccess] = useState<Access>({
    role: user.role,
    scopes: user.role === "custom" ? user.customScopes : [],
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (access.role === "custom" && access.scopes.length === 0) {
      return toast.error("Pick at least one scope for a custom role");
    }

    try {
      setLoading(true);
      const { error } = await updateAccess(user.id, access);

      if (error) return toast.error(error.message);

      toast.success(`Updated access for ${user.name}`);
      onClose();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Change access for {user.name}</DialogTitle>
          <DialogDescription>
            Applies right away, to their dashboard and their API keys alike.
          </DialogDescription>
        </DialogHeader>

        <AccessPicker
          idPrefix={`edit-${user.id}`}
          value={access}
          onChange={setAccess}
          disabled={loading}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResetPasswordDialog({ user, onClose }: Props) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setLoading(true);
      const { error } = await resetPassword(user.id, password);

      if (error) return toast.error(error.message);

      toast.success(`Password reset for ${user.name}`, {
        description: "Share the new password with them.",
      });
      onClose();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password for {user.name}</DialogTitle>
          <DialogDescription>
            They&apos;ll be signed out of every device and need the new password
            to sign back in. Their API keys keep working.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* tells password managers which account the new password is for */}
          <input
            type="email"
            autoComplete="username"
            value={user.email}
            readOnly
            hidden
          />
          <div className="space-y-2">
            <Label htmlFor={`reset-${user.id}`}>New password</Label>
            <PasswordInput
              id={`reset-${user.id}`}
              value={password}
              onChange={setPassword}
              disabled={loading}
            />
            <p className="text-muted-foreground text-sm">
              At least 8 characters.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !password}>
              {loading ? "Resetting..." : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
