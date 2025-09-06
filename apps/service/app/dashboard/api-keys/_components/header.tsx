import { Key } from "lucide-react";

export default function Header() {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center gap-3">
        <Key className="text-primary h-8 w-8" />
        <h1 className="text-foreground text-3xl font-bold">
          API Key Management
        </h1>
      </div>
      <p className="text-muted-foreground text-balance">
        Generate and manage your API keys securely. Keep your keys safe and
        rotate them regularly.
      </p>
    </div>
  );
}
