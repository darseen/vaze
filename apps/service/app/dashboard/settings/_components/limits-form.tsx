"use client";

import updateLimits from "@/actions/settings/update-limits";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Limits } from "@/lib/settings";
import { Gauge } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Unit = { label: string; factor: number };

const SIZE_UNITS: Unit[] = [
  { label: "KB", factor: 1024 },
  { label: "MB", factor: 1024 ** 2 },
  { label: "GB", factor: 1024 ** 3 },
  { label: "TB", factor: 1024 ** 4 },
];

const DURATION_UNITS: Unit[] = [
  { label: "seconds", factor: 1 },
  { label: "minutes", factor: 60 },
  { label: "hours", factor: 60 * 60 },
  { label: "days", factor: 24 * 60 * 60 },
];

const DAY_UNITS: Unit[] = [{ label: "days", factor: 1 }];

const FIELDS: {
  key: keyof Limits;
  label: string;
  description: string;
  units: Unit[];
}[] = [
  {
    key: "maxUploadSize",
    label: "Maximum upload size",
    description: "Largest single file an upload may contain.",
    units: SIZE_UNITS,
  },
  {
    key: "hostingCacheMaxAge",
    label: "Public cache lifetime",
    description:
      "How long browsers and CDNs may reuse a public file before checking for changes. 0 checks every time.",
    units: DURATION_UNITS,
  },
  {
    key: "defaultPresignTtl",
    label: "Default signed link lifetime",
    description: "Used when a signing request doesn't ask for a lifetime.",
    units: DURATION_UNITS,
  },
  {
    key: "maxPresignTtl",
    label: "Maximum signed link lifetime",
    description: "Longer requests are shortened to this.",
    units: DURATION_UNITS,
  },
  {
    key: "activityRetentionDays",
    label: "Activity history",
    description: "Activity entries older than this are deleted.",
    units: DAY_UNITS,
  },
  {
    key: "apiRequestRetentionDays",
    label: "API request log",
    description:
      "Older request records are deleted. They feed the dashboard's API usage chart.",
    units: DAY_UNITS,
  },
];

type Field = { amount: string; unit: number };

// show a value in the largest unit that divides it evenly
function split(value: number, units: Unit[]): Field {
  const unit =
    units.findLast((u) => value >= u.factor && value % u.factor === 0) ??
    units[0];
  return { amount: String(value / unit.factor), unit: unit.factor };
}

function toFields(limits: Limits) {
  return Object.fromEntries(
    FIELDS.map(({ key, units }) => [key, split(limits[key], units)]),
  ) as Record<keyof Limits, Field>;
}

function toValue({ amount, unit }: Field): number {
  return amount.trim() === "" ? NaN : Math.round(Number(amount) * unit);
}

interface Props {
  limits: Limits;
}

export default function LimitsForm({ limits: initial }: Props) {
  const [saved, setSaved] = useState(initial);
  const [fields, setFields] = useState(() => toFields(initial));
  const [loading, setLoading] = useState(false);

  const dirty = FIELDS.some(({ key }) => toValue(fields[key]) !== saved[key]);

  const setField = (key: keyof Limits, change: Partial<Field>) =>
    setFields((current) => ({
      ...current,
      [key]: { ...current[key], ...change },
    }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const limits = {} as Limits;
    for (const { key, label } of FIELDS) {
      const value = toValue(fields[key]);
      if (!Number.isFinite(value))
        return toast.error(`Enter a number for ${label}`);
      limits[key] = value;
    }

    try {
      setLoading(true);
      const { data, error } = await updateLimits(limits);

      if (error) return toast.error(error.message);

      setSaved(data.limits);
      setFields(toFields(data.limits));
      toast.success("Limits saved");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          Limits
        </CardTitle>
        <CardDescription>
          Changes apply right away, no restart needed. The matching environment
          variables only set the starting values.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {FIELDS.map(({ key, label, description, units }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`limit-${key}`}>{label}</Label>
                <div className="flex gap-2">
                  <Input
                    id={`limit-${key}`}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={fields[key].amount}
                    onChange={(e) => setField(key, { amount: e.target.value })}
                    required
                  />
                  {units.length > 1 ? (
                    <Select
                      value={String(fields[key].unit)}
                      onValueChange={(value) =>
                        setField(key, { unit: Number(value) })
                      }
                    >
                      <SelectTrigger
                        className="w-28 shrink-0"
                        aria-label={`${label} unit`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem
                            key={unit.factor}
                            value={String(unit.factor)}
                          >
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-muted-foreground flex w-28 shrink-0 items-center px-3 text-sm">
                      {units[0].label}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">{description}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={!dirty || loading}>
              {loading ? "Saving..." : "Save limits"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
