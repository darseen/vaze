import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="border-border/50 bg-card/50 h-full gap-5">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="text-base font-medium">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {aside}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">{children}</CardContent>
    </Card>
  );
}

/** The large number in a panel's top corner. */
export function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="shrink-0 text-right">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

export function Empty({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex min-h-40 flex-1 flex-col items-center justify-center gap-1 text-center text-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A thin bar showing `share` (0 to 1) of its track. */
export function ShareBar({
  share,
  className = "bg-usage",
}: {
  share: number;
  className?: string;
}) {
  return (
    <div className="bg-muted h-1 overflow-hidden rounded-full">
      <div
        className={cn("h-full rounded-full", className)}
        style={{ width: `${Math.min(Math.max(share, 0), 1) * 100}%` }}
      />
    </div>
  );
}
