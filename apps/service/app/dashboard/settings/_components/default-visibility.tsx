"use client";

import updateDefaultVisibility from "@/actions/settings/update-default-visibility";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Visibility } from "@repo/types";
import { Eye, Globe, Lock, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const options: {
  value: Visibility;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "public",
    label: "Public",
    description: "Anyone with the link can open new files.",
    icon: Globe,
  },
  {
    value: "private",
    label: "Private",
    description: "New files need an API key or a signed URL to open.",
    icon: Lock,
  },
];

interface Props {
  visibility: Visibility;
}

export default function DefaultVisibility({ visibility: initial }: Props) {
  const [visibility, setVisibility] = useState(initial);
  const [loading, setLoading] = useState(false);

  const handleChange = async (value: string) => {
    const previous = visibility;
    setVisibility(value as Visibility);

    try {
      setLoading(true);
      const { error } = await updateDefaultVisibility(value);

      if (error) {
        setVisibility(previous);
        return toast.error(error.message);
      }

      toast.success(
        value === "private"
          ? "New files and folders are now private by default"
          : "New files and folders are now public by default",
      );
    } catch {
      setVisibility(previous);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Default Visibility
        </CardTitle>
        <CardDescription>
          Choose whether new files and folders start out public or private.
          Existing files keep their current visibility.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={visibility}
          onValueChange={handleChange}
          disabled={loading}
          className="grid-cols-1 sm:grid-cols-2"
        >
          {options.map((option) => (
            <Label
              key={option.value}
              htmlFor={`visibility-${option.value}`}
              className="hover:bg-accent/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 dark:has-data-[state=checked]:bg-primary/10 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors"
            >
              <RadioGroupItem
                value={option.value}
                id={`visibility-${option.value}`}
                className="mt-0.5"
              />
              <div className="grid gap-1.5">
                <span className="flex items-center gap-2">
                  <option.icon className="h-4 w-4" />
                  {option.label}
                </span>
                <span className="text-muted-foreground leading-snug font-normal">
                  {option.description}
                </span>
              </div>
            </Label>
          ))}
        </RadioGroup>
        <p className="text-muted-foreground text-sm">
          Applies to uploads from the dashboard and to API uploads that
          don&apos;t set a <code className="font-mono">visibility</code>. A
          folder is as private as the files inside it, so new folders follow
          this setting too.
        </p>
      </CardContent>
    </Card>
  );
}
