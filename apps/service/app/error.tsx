"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mb-4 flex items-center justify-center">
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
          <CardTitle className="text-xl text-red-600">
            Something went wrong
          </CardTitle>
          <CardDescription>
            An unexpected error occurred while processing your request. Our team
            has been notified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium text-red-800">Error Details:</p>
            <p className="mt-1 font-mono text-sm text-red-700">
              {error.message || "An unknown error occurred"}
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-red-600">
                Error ID: {error.digest}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={reset} className="flex flex-1 items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" asChild className="flex-1 bg-transparent">
              <Link href="/" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Go Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
