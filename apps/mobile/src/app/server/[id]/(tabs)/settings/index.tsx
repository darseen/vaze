import { router, Stack } from "expo-router";
import { Avatar, Chip, Tabs } from "heroui-native";
import {
  ArchiveRestore,
  ArrowLeftRight,
  ChevronRight,
  Gauge,
  Globe,
  KeyRound,
  LockKeyhole,
  LogOut,
  MonitorSmartphone,
  UserRound,
  Users,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { ListSection } from "@/components/list-section";
import { useServer } from "@/components/server-context";
import { ServerSwitcherSheet } from "@/components/server-switcher-sheet";
import { initials } from "@/lib/format";
import { roleLabel } from "@/lib/scopes";
import { hostOf } from "@/lib/server-url";
import { useLibrary } from "@/stores/library";
import { usePreferences, type ThemePreference } from "@/stores/preferences";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const PAGES = {
  profile: "/server/[id]/settings/profile",
  password: "/server/[id]/settings/password",
  devices: "/server/[id]/settings/devices",
  keys: "/server/[id]/settings/keys",
  users: "/server/[id]/settings/users",
  visibility: "/server/[id]/settings/visibility",
  limits: "/server/[id]/settings/limits",
  deleted: "/server/[id]/deleted",
} as const;

export default function SettingsScreen() {
  const { server, vaze, me, can, signOut } = useServer();
  const deleted = useLibrary((state) => state.deleted[server.id]);
  const loadDeleted = useLibrary((state) => state.loadDeleted);
  const theme = usePreferences((state) => state.theme);
  const setTheme = usePreferences((state) => state.setTheme);
  const [switching, setSwitching] = useState(false);

  // whether the server keeps deleted files decides if its row shows
  const known = deleted?.supported !== undefined;
  useEffect(() => {
    if (!known && can("files:read")) loadDeleted(server.id, vaze);
  }, [known, can, loadDeleted, server.id, vaze]);

  const open = (page: keyof typeof PAGES) => () =>
    router.push({ pathname: PAGES[page], params: { id: server.id } });

  return (
    <>
      <Stack.Screen options={{ title: "Settings", headerLargeTitle: true }} />
      <ScrollView
        contentContainerClassName="gap-6 px-5 pt-3 pb-8"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Pressable
          onPress={open("profile")}
          className="flex-row items-center gap-4 rounded-3xl border border-border bg-surface p-4 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <Avatar size="lg" color="accent" variant="soft" alt={me.user.name}>
            <Avatar.Fallback>{initials(me.user.name)}</Avatar.Fallback>
          </Avatar>
          <View className="flex-1 gap-1">
            <Text
              numberOfLines={1}
              className="text-lg font-medium text-foreground"
            >
              {me.user.name}
            </Text>
            <Text numberOfLines={1} className="font-normal text-sm text-muted">
              {me.user.email}
            </Text>
            <View className="flex-row">
              <Chip size="sm" variant="soft" color="accent">
                <Chip.Label>{roleLabel(me.user.role)}</Chip.Label>
              </Chip>
            </View>
          </View>
          <Icon icon={ChevronRight} size={18} className="text-muted" />
        </Pressable>

        <ListSection
          title="Account"
          rows={[
            {
              label: "Profile",
              icon: UserRound,
              description: "Your name and sign-in email",
              onPress: open("profile"),
            },
            {
              label: "Password",
              icon: LockKeyhole,
              description: "Change the password you sign in with",
              onPress: open("password"),
            },
            {
              label: "Devices",
              icon: MonitorSmartphone,
              description: "Where your account is signed in",
              onPress: open("devices"),
            },
          ]}
        />

        <ListSection
          title="Manage"
          rows={[
            {
              label: "Recently deleted",
              icon: ArchiveRestore,
              description: deleted?.data?.items.length
                ? `${deleted.data.items.length} ${deleted.data.items.length === 1 ? "item" : "items"} you can restore`
                : "Restore deleted files and folders",
              hidden: !can("files:read") || deleted?.supported !== true,
              onPress: open("deleted"),
            },
            {
              label: "API keys",
              icon: KeyRound,
              description: "Keys for your own apps and scripts",
              hidden: !can("api-keys:manage"),
              onPress: open("keys"),
            },
            {
              label: "Users",
              icon: Users,
              description: "Who can sign in and what they can do",
              hidden: !can("users:manage"),
              onPress: open("users"),
            },
          ]}
        />

        <ListSection
          title="Server"
          footer="These apply to everyone on this server."
          rows={[
            {
              label: "Default visibility",
              icon: Globe,
              description: "Public or private for new files",
              hidden: !can("settings:manage"),
              onPress: open("visibility"),
            },
            {
              label: "Limits",
              icon: Gauge,
              description: "Uploads, signed links and how long things are kept",
              hidden: !can("settings:manage"),
              onPress: open("limits"),
            },
          ]}
        />

        <ListSection title="Appearance">
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
        </ListSection>

        <ListSection
          rows={[
            {
              label: "Switch server",
              icon: ArrowLeftRight,
              description: `Connected to ${hostOf(server.url)}`,
              chevron: false,
              onPress: () => setSwitching(true),
            },
          ]}
        />

        <ListSection
          rows={[
            {
              label: "Sign out",
              icon: LogOut,
              danger: true,
              chevron: false,
              onPress: signOut,
            },
          ]}
        />
      </ScrollView>

      <ServerSwitcherSheet isOpen={switching} onOpenChange={setSwitching} />
    </>
  );
}
