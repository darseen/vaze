import type { LucideIcon } from "lucide-react-native";
import type { ColorValue } from "react-native";
import { useResolveClassNames } from "uniwind";

type IconProps = {
  icon: LucideIcon;
  /** A text color class, such as `text-muted`. */
  className?: string;
  size?: number;
  strokeWidth?: number;
};

export function Icon({
  icon: Glyph,
  className = "text-foreground",
  size = 20,
  strokeWidth = 1.75,
}: IconProps) {
  const { color } = useResolveClassNames(className) as { color?: ColorValue };
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
}
