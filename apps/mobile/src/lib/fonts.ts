import { Platform } from "react-native";

// for style props that take no className, like navigation headers
export const fonts = Platform.select({
  android: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    mono: "monospace",
  },
  default: {
    regular: "Inter-Regular",
    medium: "Inter-Medium",
    semibold: "Inter-SemiBold",
    mono: "Menlo",
  },
});
