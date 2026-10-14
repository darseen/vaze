import { Avatar, Chip, Label, Tabs } from "heroui-native";
import { ArrowLeftRight, LogOut } from "lucide-react-native";
import { Text, View } from "react-native";
import { initials } from "@/lib/format";
import { hostOf } from "@/lib/server-url";
import { usePreferences, type ThemePreference } from "@/stores/preferences";
import { ActionGroup } from "./action-group";
import { useServer } from "./server-context";
import { Sheet } from "./sheet";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
  custom: "Custom access",
};

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type AccountSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchServer: () => void;
};

export function AccountSheet({
  isOpen,
  onOpenChange,
  onSwitchServer,
}: AccountSheetProps) {
  const { me, server, signOut } = useServer();
  const theme = usePreferences((state) => state.theme);
  const setTheme = usePreferences((state) => state.setTheme);

  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <View className="gap-6">
        <View className="flex-row items-center gap-4">
          <Avatar size="lg" color="accent" variant="soft" alt={me.user.name}>
            <Avatar.Fallback>{initials(me.user.name)}</Avatar.Fallback>
          </Avatar>
          <View className="flex-1 gap-0.5">
            <Text
              numberOfLines={1}
              className="text-lg font-medium text-foreground"
            >
              {me.user.name}
            </Text>
            <Text numberOfLines={1} className="font-normal text-sm text-muted">
              {me.user.email}
            </Text>
          </View>
          <Chip size="sm" variant="soft" color="accent">
            <Chip.Label>{ROLE_LABELS[me.user.role] ?? me.user.role}</Chip.Label>
          </Chip>
        </View>

        <View className="gap-2">
          <Label>Appearance</Label>
          <Tabs
            value={theme}
            onValueChange={(value) => setTheme(value as ThemePreference)}
          >
            <Tabs.List className="w-full">
              <Tabs.Indicator />
              {THEMES.map((option) => (
                <Tabs.Trigger
                  key={option.value}
                  value={option.value}
                  className="flex-1"
                >
                  <Tabs.Label>{option.label}</Tabs.Label>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs>
        </View>

        <View className="gap-3">
          <ActionGroup
            actions={[
              {
                label: "Switch server",
                icon: ArrowLeftRight,
                description: `Connected to ${hostOf(server.url)}`,
                onPress: onSwitchServer,
              },
            ]}
          />
          <ActionGroup
            actions={[
              {
                label: "Sign out",
                icon: LogOut,
                danger: true,
                onPress: signOut,
              },
            ]}
          />
        </View>
      </View>
    </Sheet>
  );
}
