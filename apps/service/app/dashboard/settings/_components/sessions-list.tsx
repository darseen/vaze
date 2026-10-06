"use client";

import revokeOtherSessions from "@/actions/account/revoke-other-sessions";
import revokeSession from "@/actions/account/revoke-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatIpAddress } from "@/utils";
import { describeUserAgent, isMobileUserAgent } from "@/utils/user-agent";
import { Laptop, MonitorSmartphone, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { SessionSummary } from "../_utils/fetch-settings";

// marks the "sign out other devices" request as the pending one
const OTHERS = "others";

interface Props {
  sessions: SessionSummary[];
}

export default function SessionsList({ sessions }: Props) {
  const [pending, setPending] = useState<string | null>(null);

  const hasOthers = sessions.some((session) => !session.current);

  const handleRevoke = async (id: string) => {
    try {
      setPending(id);
      const { error } = await revokeSession(id);

      if (error) return toast.error(error.message);

      toast.success("Device signed out");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setPending(null);
    }
  };

  const handleRevokeOthers = async () => {
    try {
      setPending(OTHERS);
      const { error } = await revokeOtherSessions();

      if (error) return toast.error(error.message);

      toast.success("All other devices signed out");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setPending(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorSmartphone className="h-5 w-5" />
          Sessions
        </CardTitle>
        <CardDescription>
          Devices signed in to your account. Sign out any you don&apos;t
          recognize.
        </CardDescription>
        {hasOthers && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeOthers}
              disabled={pending !== null}
            >
              {pending === OTHERS ? "Signing out..." : "Sign out other devices"}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {sessions.map((session) => {
            const DeviceIcon = isMobileUserAgent(session.userAgent)
              ? Smartphone
              : Laptop;

            return (
              <li key={session.id} className="flex items-center gap-3 p-3">
                <DeviceIcon className="text-muted-foreground h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {describeUserAgent(session.userAgent)}
                    {session.current && (
                      <Badge variant="secondary">This device</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {session.ipAddress
                      ? formatIpAddress(session.ipAddress)
                      : "Unknown IP"}{" "}
                    · Signed in {formatDate(session.createdAt)}
                  </p>
                </div>
                {!session.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(session.id)}
                    disabled={pending !== null}
                  >
                    {pending === session.id ? "Signing out..." : "Sign out"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
