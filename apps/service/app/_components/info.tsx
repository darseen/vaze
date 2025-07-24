import { Database, Lock, Network, Zap } from "lucide-react";

export default function Info() {
  return (
    <section className="bg-primary-foreground flex flex-1 items-center justify-center px-8">
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
              <p>Enterprise-grade security with local control over your data</p>
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
    </section>
  );
}
