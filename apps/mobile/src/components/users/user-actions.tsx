import type { User } from "@darseen/vaze";
import { useToast } from "heroui-native";
import {
  LockKeyhole,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
} from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { roleLabel } from "@/lib/scopes";
import { ActionGroup } from "../action-group";
import { ConfirmSheet } from "../confirm-sheet";
import { useServer } from "../server-context";
import { Sheet, SHEET_CLOSE_MS } from "../sheet";
import type { Access } from "./access-picker";
import { AccessSheet, ResetPasswordSheet } from "./user-sheets";

type SheetName = "details" | "access" | "password" | "disable" | "delete";

type Notice = {
  variant: "success" | "danger";
  label: string;
  description?: string;
};

/** The options sheet for a user, plus the sheets it leads to. */
export function useUserActions(onChanged: () => void) {
  const { vaze } = useServer();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [enabling, setEnabling] = useState(false);

  // a closing sheet reports false after the next one may already be open
  const closer = (name: SheetName) => (open: boolean) => {
    if (!open) setSheet((current) => (current === name ? null : current));
  };

  const notify = (notice: Notice) =>
    setTimeout(() => toast.show(notice), SHEET_CLOSE_MS);

  function open(next: User) {
    setUser(next);
    setSheet("details");
  }

  async function saveAccess(access: Access) {
    if (!user) return null;
    const { error } = await vaze.users.setAccess({ id: user.id, ...access });
    if (error) return error.message;

    onChanged();
    notify({ variant: "success", label: `Updated access for ${user.name}` });
    return null;
  }

  async function resetPassword(password: string) {
    if (!user) return null;
    const { error } = await vaze.users.resetPassword({ id: user.id, password });
    if (error) return error.message;

    onChanged();
    notify({
      variant: "success",
      label: `Password reset for ${user.name}`,
      description: "Share the new password with them.",
    });
    return null;
  }

  async function setDisabled(disabled: boolean) {
    if (!user) return;
    const { error } = await vaze.users.setDisabled({ id: user.id, disabled });

    if (error) {
      notify({
        variant: "danger",
        label: disabled
          ? "Couldn't disable the user"
          : "Couldn't enable the user",
        description: error.message,
      });
      return;
    }

    onChanged();
    notify({
      variant: "success",
      label: disabled
        ? `${user.name} is disabled`
        : `${user.name} can sign in again`,
    });
  }

  async function enable() {
    setEnabling(true);
    await setDisabled(false);
    setEnabling(false);
    setSheet(null);
  }

  async function remove() {
    if (!user) return;
    const { error } = await vaze.users.delete(user.id);

    if (error) {
      notify({
        variant: "danger",
        label: "Couldn't delete the user",
        description: error.message,
      });
      return;
    }

    onChanged();
    notify({ variant: "success", label: `${user.name} was deleted` });
  }

  const element = (
    <>
      <Sheet
        isOpen={sheet === "details"}
        onOpenChange={closer("details")}
        title={user?.name}
        description={
          user ? `${user.email} · ${roleLabel(user.role)}` : undefined
        }
      >
        <View className="gap-3">
          <ActionGroup
            actions={[
              {
                label: "Change access",
                icon: UserCog,
                description: "Role and scopes",
                onPress: () => setSheet("access"),
              },
              {
                label: "Reset password",
                icon: LockKeyhole,
                description: "Signs them out everywhere",
                onPress: () => setSheet("password"),
              },
              user?.disabled
                ? {
                    label: "Enable",
                    icon: UserCheck,
                    description: "Lets them sign in again",
                    busy: enabling,
                    onPress: enable,
                  }
                : {
                    label: "Disable",
                    icon: UserX,
                    description: "Blocks sign-in and pauses their API keys",
                    onPress: () => setSheet("disable"),
                  },
            ]}
          />
          <ActionGroup
            actions={[
              {
                label: "Delete user",
                icon: Trash2,
                description: "Removes their account, keys and history",
                danger: true,
                onPress: () => setSheet("delete"),
              },
            ]}
          />
        </View>
      </Sheet>
      <AccessSheet
        user={user}
        isOpen={sheet === "access"}
        onOpenChange={closer("access")}
        onSave={saveAccess}
      />
      <ResetPasswordSheet
        user={user}
        isOpen={sheet === "password"}
        onOpenChange={closer("password")}
        onReset={resetPassword}
      />
      <ConfirmSheet
        isOpen={sheet === "disable"}
        onOpenChange={closer("disable")}
        title={user ? `Disable ${user.name}?` : "Disable user?"}
        description="They're signed out everywhere and their API keys stop working until you enable them again. Nothing is deleted."
        confirmLabel="Disable"
        onConfirm={() => setDisabled(true)}
      />
      <ConfirmSheet
        isOpen={sheet === "delete"}
        onOpenChange={closer("delete")}
        title={user ? `Delete ${user.name}?` : "Delete user?"}
        description="Their account, API keys and activity history are removed for good. Files they uploaded stay. To only block access, disable them instead."
        confirmLabel="Delete user"
        onConfirm={remove}
      />
    </>
  );

  return { open, element };
}
