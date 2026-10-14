import { Platform } from "react-native";

// for style props that take no className, like navigation headers
export const fonts = Platform.select({
  android: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
  },
  default: {
    regular: "Inter-Regular",
    medium: "Inter-Medium",
    semibold: "Inter-SemiBold",
  },
});
