"use client";

import register from "@/actions/auth/register";
import logo from "@/assets/images/vaze.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function RegisterForm() {
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { error } = await register(formData);

    if (error) return toast.error(error.message);

    toast.success("Account created successfully");
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
          <h2 className="flex items-center justify-center gap-2 text-xl font-bold sm:text-2xl">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
            Create Admin Account
          </h2>
          <p className="mt-2 text-sm sm:text-base">
            Register a new administrator account for Vaze
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              required
            />
          </div>
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
          <div className="bg-accent text-accent-foreground rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs sm:text-sm">
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
    </section>
  );
}
