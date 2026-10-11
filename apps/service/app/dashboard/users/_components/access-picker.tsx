"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ALL_ROLES,
  ALL_SCOPES,
  ASSIGNABLE_SCOPES,
  isRole,
  ROLE_INFO,
  SCOPE_INFO,
} from "@/lib/permissions";
import type { Role, Scope } from "@repo/types";

export interface Access {
  role: Role;
  scopes: Scope[];
}

interface Props {
  value: Access;
  onChange: (value: Access) => void;
  disabled?: boolean;
  idPrefix: string;
}

export default function AccessPicker({
  value,
  onChange,
  disabled,
  idPrefix,
}: Props) {
  const preset = ROLE_INFO[value.role].scopes;
  const isCustom = preset === null;

  const changeRole = (next: string) => {
    if (!isRole(next)) return;
    // switching to custom starts from what the previous role granted
    const scopes =
      next === "custom" && preset
        ? ASSIGNABLE_SCOPES.filter((scope) => preset.includes(scope))
        : value.scopes;
    onChange({ role: next, scopes });
  };

  const toggleScope = (scope: Scope, checked: boolean) => {
    const picked = new Set(value.scopes);
    if (checked) picked.add(scope);
    else picked.delete(scope);
    onChange({
      role: value.role,
      scopes: ASSIGNABLE_SCOPES.filter((item) => picked.has(item)),
    });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Role</Label>
        <RadioGroup
          value={value.role}
          onValueChange={changeRole}
          disabled={disabled}
          className="grid-cols-1 sm:grid-cols-2"
        >
          {ALL_ROLES.map((role) => (
            <Label
              key={role}
              htmlFor={`${idPrefix}-role-${role}`}
              className="hover:bg-accent/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 dark:has-data-[state=checked]:bg-primary/10 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
            >
              <RadioGroupItem
                value={role}
                id={`${idPrefix}-role-${role}`}
                className="mt-0.5"
              />
              <div className="grid gap-1">
                <span>{ROLE_INFO[role].label}</span>
                <span className="text-muted-foreground leading-snug font-normal">
                  {ROLE_INFO[role].description}
                </span>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <div>
          <Label>Scopes</Label>
          <p className="text-muted-foreground mt-1 text-sm">
            {isCustom
              ? "Pick exactly what this account can do."
              : `Included with the ${ROLE_INFO[value.role].label} role. Choose Custom to pick your own.`}
          </p>
        </div>
        <ul className="divide-y rounded-lg border">
          {ALL_SCOPES.map((scope) => {
            const assignable = ASSIGNABLE_SCOPES.includes(scope);
            const checked = isCustom
              ? value.scopes.includes(scope)
              : preset.includes(scope);

            return (
              <li key={scope}>
                <Label
                  htmlFor={`${idPrefix}-scope-${scope}`}
                  className="flex items-start gap-3 p-3 font-normal has-disabled:cursor-default"
                >
                  <Checkbox
                    id={`${idPrefix}-scope-${scope}`}
                    checked={checked}
                    disabled={disabled || !isCustom || !assignable}
                    onCheckedChange={(state) =>
                      toggleScope(scope, state === true)
                    }
                    className="mt-0.5"
                  />
                  <div className="grid gap-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {SCOPE_INFO[scope].label}
                      <code className="text-muted-foreground bg-muted rounded px-1 py-0.5 font-mono text-xs">
                        {scope}
                      </code>
                    </span>
                    <span className="text-muted-foreground text-sm leading-snug">
                      {SCOPE_INFO[scope].description}
                      {!assignable && " Only the Admin role has it."}
                    </span>
                  </div>
                </Label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
