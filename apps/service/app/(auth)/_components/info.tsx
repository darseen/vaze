import { Database, Lock, Network, Zap } from "lucide-react";

export default function Info() {
  return (
    <section className="bg-primary-foreground flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:py-0">
      <div className="max-w-lg">
        <h2 className="mb-6 text-center text-2xl font-bold sm:text-3xl lg:text-left lg:text-4xl">
          Your Files, Your Control
        </h2>
        <p className="mb-8 text-center text-lg sm:text-xl lg:text-left">
          Vaze provides secure, fast, and reliable local file storage for your
          needs. Keep your data close and your access instant.
        </p>

        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg p-2">
              <Lock className="size-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Secure Storage</h3>
              <p className="text-sm sm:text-base">
                Enterprise-grade security with local control over your data
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="rounded-lg p-2">
              <Database className="size-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Storage Analytics</h3>
              <p className="text-sm sm:text-base">
                Monitor usage, performance, and storage capacity
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="rounded-lg p-2">
              <Zap className="size-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Lightning Fast</h3>
              <p className="text-sm sm:text-base">
                Local storage means instant access to your files
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="rounded-lg p-2">
              <Network className="size-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">API Integration</h3>
              <p className="text-sm sm:text-base">
                Integrate with your existing applications and workflows
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
