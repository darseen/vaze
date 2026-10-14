import { cn, type InputProps, type InputRef } from "heroui-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useState, type Ref } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "./icon";
import { SheetInput } from "./sheet-input";

/** A password field with a show/hide toggle, on a screen or in a sheet. */
export function PasswordInput({
  className,
  ...props
}: Omit<InputProps, "secureTextEntry"> & { ref?: Ref<InputRef> }) {
  const [visible, setVisible] = useState(false);

  return (
    <View className="justify-center">
      <SheetInput
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        secureTextEntry={!visible}
        className={cn("pr-12", className)}
      />
      <Pressable
        onPress={() => setVisible((value) => !value)}
        hitSlop={12}
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        className="absolute right-4"
      >
        <Icon icon={visible ? EyeOff : Eye} size={18} className="text-muted" />
      </Pressable>
    </View>
  );
}
