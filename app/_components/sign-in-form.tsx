import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInForm() {
  return (
    <section className="text-foreground flex flex-1 items-center justify-center px-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold">Welcome back</h2>
          <p className="text-muted-foreground">Sign in to your dashboard</p>
        </div>

        <form className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              placeholder="Enter your username"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Sign In
          </Button>
        </form>
      </div>
    </section>
  );
}
