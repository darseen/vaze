"use client";

import changePassword from "@/actions/account/change-password";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function PasswordForm({ email }: { email: string }) {
  const [fields, setFields] = useState(EMPTY);
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [loading, setLoading] = useState(false);

  const update =
    (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((current) => ({ ...current, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (fields.newPassword !== fields.confirmPassword) {
      return toast.error("Passwords do not match");
    }

    try {
      setLoading(true);
      const { error } = await changePassword({
        ...fields,
        revokeOtherSessions,
      });

      if (error) return toast.error(error.message);

      setFields(EMPTY);
      toast.success(
        revokeOtherSessions
          ? "Password changed and other devices signed out"
          : "Password changed",
      );
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Password
        </CardTitle>
        <CardDescription>
          Use at least 8 characters. You&apos;ll need your current password to
          set a new one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* tells password managers which account the new password is for */}
          <input
            type="email"
            autoComplete="username"
            value={email}
            readOnly
            hidden
          />
          <div className="space-y-2 sm:max-w-[calc(50%-0.5rem)]">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={fields.currentPassword}
              onChange={update("currentPassword")}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={fields.newPassword}
                onChange={update("newPassword")}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={fields.confirmPassword}
                onChange={update("confirmPassword")}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Label className="font-normal">
              <Checkbox
                checked={revokeOtherSessions}
                onCheckedChange={(checked) =>
                  setRevokeOtherSessions(checked === true)
                }
              />
              Sign out all other devices
            </Label>
            <Button type="submit" disabled={loading}>
              {loading ? "Changing..." : "Change password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
