"use client";

import { useCan } from "@/app/dashboard/_components/permissions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KEY_SCOPES, SCOPE_INFO } from "@/lib/permissions";
import { copyToClipboard } from "@/utils/clipboard";
import type { ApiResponse, CreatedApiKey, Scope } from "@repo/types";
import { Check, Copy, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function GenerateKey() {
  const router = useRouter();
  const can = useCan();
  const heldScopes = KEY_SCOPES.filter(can);
  const [keyName, setKeyName] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [expirationType, setExpirationType] = useState<string>("never");
  const [scopes, setScopes] = useState<Scope[]>(heldScopes);
  const [loading, setLoading] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [generatedKey, setGeneratedKey] = useState({
    key: "",
    name: "",
  });
  const [copied, setCopied] = useState(false);

  const calculateExpirationDate = (type: string): Date | null => {
    const now = new Date();
    switch (type) {
      case "1h":
        return new Date(now.getTime() + 60 * 60 * 1000);
      case "1d":
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case "7d":
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case "30d":
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      case "90d":
        return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      case "1y":
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      case "never":
        return null;
      default:
        return null;
    }
  };

  const handleExpirationTypeChange = (type: string) => {
    setExpirationType(type);
    setExpiresAt(calculateExpirationDate(type));
  };

  const toggleScope = (scope: Scope, checked: boolean) => {
    const picked = new Set(scopes);
    if (checked) picked.add(scope);
    else picked.delete(scope);
    setScopes(KEY_SCOPES.filter((item) => picked.has(item)));
  };

  const handleCopyKey = async () => {
    const success = await copyToClipboard(generatedKey.key);
    if (!success) {
      toast.error("Failed to copy to clipboard");
      return;
    }
    setCopied(true);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateApiKey = async () => {
    try {
      if (!keyName.trim()) {
        toast.error("Please enter a key name");
        return;
      }

      if (scopes.length === 0) {
        toast.error("Pick at least one scope");
        return;
      }

      setLoading(true);

      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName,
          scopes,
          expiresAt: expiresAt?.toISOString() ?? null,
        }),
      });
      const { data, error } = (await response.json()) as ApiResponse<{
        key: CreatedApiKey;
      }>;

      if (error) return toast.error(error.message);

      const newKey = data.key;

      setGeneratedKey({
        key: newKey.key,
        name: newKey.name,
      });
      setShowKeyDialog(true);
      toast.success(`API key ${newKey.name} has been created successfully.`);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      setKeyName("");
      setExpirationType("never");
      setExpiresAt(null);
      setScopes(heldScopes);
    }
  };

  const handleDialogClose = () => {
    setShowKeyDialog(false);
    setCopied(false);
  };

  return (
    <>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Generate New Key
          </CardTitle>
          <CardDescription>
            Create a new API key for your applications. Give it a descriptive
            name, only the scopes it needs, and an expiration date for security.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex w-full items-center gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  placeholder="Enter key name (e.g., Production API, Mobile App)"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerateApiKey()}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration">Expiration</Label>
                <Select
                  value={expirationType}
                  onValueChange={handleExpirationTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never expires</SelectItem>
                    <SelectItem value="1h">1 hour</SelectItem>
                    <SelectItem value="1d">1 day</SelectItem>
                    <SelectItem value="7d">7 days</SelectItem>
                    <SelectItem value="30d">30 days</SelectItem>
                    <SelectItem value="90d">90 days</SelectItem>
                    <SelectItem value="1y">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {expiresAt && (
              <div className="text-muted-foreground text-sm">
                Key will expire on: {expiresAt.toLocaleString()}
              </div>
            )}

            <div className="space-y-2">
              <div>
                <Label>Scopes</Label>
                <p className="text-muted-foreground mt-1 text-sm">
                  What this key can do. It never goes beyond your own access.
                </p>
              </div>
              <ul className="divide-y rounded-lg border">
                {KEY_SCOPES.map((scope) => {
                  const held = can(scope);

                  return (
                    <li key={scope}>
                      <Label
                        htmlFor={`key-scope-${scope}`}
                        className="flex items-start gap-3 p-3 font-normal has-disabled:cursor-default"
                      >
                        <Checkbox
                          id={`key-scope-${scope}`}
                          checked={held && scopes.includes(scope)}
                          disabled={!held}
                          onCheckedChange={(state) =>
                            toggleScope(scope, state === true)
                          }
                          className="mt-0.5"
                        />
                        <div className="grid gap-1">
                          <span className="flex flex-wrap items-center gap-2 font-medium">
                            {SCOPE_INFO[scope].label}
                            <code className="text-muted-foreground bg-muted rounded px-1 py-0.5 font-mono text-xs">
                              {scope}
                            </code>
                          </span>
                          <span className="text-muted-foreground text-sm leading-snug">
                            {SCOPE_INFO[scope].description}
                            {!held && " Your account doesn't have it."}
                          </span>
                        </div>
                      </Label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <Button
              onClick={handleGenerateApiKey}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Generating..." : "Generate API Key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showKeyDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
            <DialogDescription>
              {`Your API key \`${generatedKey.name}\` has been created. Copy it now as
              this is the only time you'll be able to see it.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Input
                value={generatedKey.key}
                readOnly
                className="font-mono text-sm"
              />
              <Button size="sm" onClick={handleCopyKey} className="shrink-0">
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="text-muted-foreground text-sm">
              {`Make sure to copy your API key now. You won't be able to see it
              again!`}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
