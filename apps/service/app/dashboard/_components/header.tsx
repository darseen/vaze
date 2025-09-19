"use client";

import getUser from "@/actions/auth/get-user-from-token";
import signOut from "@/actions/auth/sign-out";
import ThemeToggle from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilesIcon, KeyIcon, LogOut, Settings, UserIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
  const [username, setUsername] = useState<string | null>(null);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) redirect("/");
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await getUser();
      if (error) return;
      setUsername(data.username);
    };
    fetchUser();
  }, []);

  return (
    <header className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/60 sticky top-0 z-50 border-b px-2 backdrop-blur">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-foreground text-2xl font-bold">
              <Link href="/dashboard" className="hover:cursor-pointer">
                Vaze
              </Link>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {username?.[0].toUpperCase() ?? "N/A"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{username}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserIcon className="mr-2 size-4" />
                  Profile
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/dashboard/api-keys">
                    <KeyIcon className="mr-2 size-4" />
                    API Keys
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/files">
                    <FilesIcon className="mr-2 size-4" />
                    Files
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
