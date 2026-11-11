import { Recycle } from "lucide-react";

export default function Header() {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center gap-3">
        <Recycle className="text-primary h-8 w-8" />
        <h1 className="text-foreground text-3xl font-bold">Conversion</h1>
      </div>
      <p className="text-muted-foreground text-balance">
        Convert files from one format to the other.
      </p>
    </div>
  );
}
