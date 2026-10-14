import type { Role, Scope } from "@darseen/vaze";
import { ControlField, Description, Label, Separator } from "heroui-native";
import { Fragment } from "react";
import { Text, View } from "react-native";
import { fonts } from "@/lib/fonts";
import {
  ALL_ROLES,
  ASSIGNABLE_SCOPES,
  ROLE_INFO,
  SCOPE_INFO,
} from "@/lib/scopes";

export type Access = { role: Role; scopes: Scope[] };

type AccessPickerProps = {
  value: Access;
  onChange: (value: Access) => void;
  disabled?: boolean;
};

/** The role list, plus scope checkboxes for the custom role. */
export function AccessPicker({ value, onChange, disabled }: AccessPickerProps) {
  const preset = ROLE_INFO[value.role].scopes;

  function changeRole(next: Role) {
    // switching to custom starts from what the previous role granted
    const scopes =
      next === "custom" && preset
        ? ASSIGNABLE_SCOPES.filter((scope) => preset.includes(scope))
        : value.scopes;
    onChange({ role: next, scopes });
  }

  function toggleScope(scope: Scope, selected: boolean) {
    onChange({
      role: value.role,
      scopes: ASSIGNABLE_SCOPES.filter((item) =>
        item === scope ? selected : value.scopes.includes(item),
      ),
    });
  }

  return (
    <View className="gap-6">
      <View className="gap-2">
        <Label>Role</Label>
        <View className="rounded-2xl border border-border">
          {ALL_ROLES.map((role, index) => (
            <Fragment key={role}>
              {index > 0 ? <Separator /> : null}
              <ControlField
                isSelected={value.role === role}
                onSelectedChange={() => changeRole(role)}
                isDisabled={disabled}
                className="items-start gap-3 p-3"
              >
                <View className="flex-1 gap-1">
                  <Label>{ROLE_INFO[role].label}</Label>
                  <Description>{ROLE_INFO[role].description}</Description>
                </View>
                <ControlField.Indicator variant="radio" />
              </ControlField>
            </Fragment>
          ))}
        </View>
      </View>

      {preset === null ? (
        <View className="gap-2">
          <View className="gap-1">
            <Label>Scopes</Label>
            <Description>
              Managing users stays with the Admin role, since it can grant
              anything.
            </Description>
          </View>
          <View className="rounded-2xl border border-border">
            {ASSIGNABLE_SCOPES.map((scope, index) => (
              <Fragment key={scope}>
                {index > 0 ? <Separator /> : null}
                <ControlField
                  isSelected={value.scopes.includes(scope)}
                  onSelectedChange={(selected) => toggleScope(scope, selected)}
                  isDisabled={disabled}
                  className="items-start gap-3 p-3"
                >
                  <View className="flex-1 gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Label>{SCOPE_INFO[scope].label}</Label>
                      <View className="rounded-lg bg-default px-1.5 py-0.5">
                        <Text
                          style={{ fontFamily: fonts.mono }}
                          className="text-xs text-muted"
                        >
                          {scope}
                        </Text>
                      </View>
                    </View>
                    <Description>{SCOPE_INFO[scope].description}</Description>
                  </View>
                  <ControlField.Indicator variant="checkbox" />
                </ControlField>
              </Fragment>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
