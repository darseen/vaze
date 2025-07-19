import { Metadata } from "next";
import { Shield, Database, Network, Zap, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Vaze",
  description: "Register | Vaze",
};

export default function Page() {
  return (
    <div className="flex min-h-screen">
      <div className="bg-primary-foreground flex flex-1 items-center justify-center px-8">
        <div className="max-w-lg">
          <h2 className="mb-6 text-4xl font-bold">Your Files, Your Control</h2>
          <p className="mb-8 text-xl">
            Vaze provides secure, fast, and reliable local file storage for your
            needs. Keep your data close and your access instant.
          </p>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg p-2">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Secure Storage</h3>
                <p>
                  Enterprise-grade security with local control over your data
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-lg p-2">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Storage Analytics</h3>
                <p>Monitor usage, performance, and storage capacity</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-lg p-2">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Lightning Fast</h3>
                <p>Local storage means instant access to your files</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-lg p-2">
                <Network className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">API Integration</h3>
                <p>Integrate with your existing applications and workflows</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h2 className="flex items-center justify-center gap-2 text-2xl font-bold">
              <Shield className="h-6 w-6" />
              Create Admin Account
            </h2>
            <p className="mt-2">
              Register a new administrator account for Vaze
            </p>
          </div>

          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Choose a username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Create a strong password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                required
              />
            </div>
            {/* Info Box - Uses accent theme color */}
            <div className="bg-accent text-accent-foreground rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p className="text-sm">
                  This will create an administrator account with full access to
                  the Vaze file storage system.
                </p>
              </div>
            </div>
            <Button type="submit" className="w-full">
              Create Admin Account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
