"use client";

import signIn from "@/actions/auth/sign-in";
import logo from "@/assets/images/vaze.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function SignInForm() {
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { error } = await signIn(formData);

    if (error) return toast.error(error.message);

    toast.success("Signed in successfully");
    router.replace("/dashboard");
  };

  return (
    <section className="flex flex-1 items-center justify-center px-4 pb-8 sm:px-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center sm:mb-8">
          <Image
            src={logo}
            alt="Vaze Logo"
            className="mx-auto h-12 w-auto md:h-16"
          />
          <h2 className="text-2xl font-bold">Welcome back</h2>
          <p className="text-muted-foreground">Sign in to your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
