import { BottomSheet } from "heroui-native";
import { useContext, type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ServerContext } from "./server-context";

// a toast shown over an open bottom sheet leaves the sheet invisible but touchable
export const SHEET_CLOSE_MS = 400;

type SheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  /** Fixed height for content that scrolls in a `BottomSheetScrollView`. */
  scrollable?: boolean;
  /** With `scrollable`, fills the screen below the status bar. */
  fullHeight?: boolean;
  children: ReactNode;
};

export function Sheet({
  isOpen,
  onOpenChange,
  title,
  description,
  scrollable = false,
  fullHeight = false,
  children,
}: SheetProps) {
  // portal content renders at the app root, outside this screen's providers
  const server = useContext(ServerContext);
  const { top } = useSafeAreaInsets();

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          keyboardBehavior="interactive"
          {...(scrollable
            ? {
                snapPoints: [fullHeight ? "100%" : "70%"],
                topInset: fullHeight ? top : 0,
                enableDynamicSizing: false,
                enableOverDrag: false,
                contentContainerClassName: "h-full",
              }
            : {})}
        >
          <ServerContext.Provider value={server}>
            {title ? (
              <View className="mb-5 gap-1">
                <BottomSheet.Title numberOfLines={1}>{title}</BottomSheet.Title>
                {description ? (
                  <BottomSheet.Description>
                    {description}
                  </BottomSheet.Description>
                ) : null}
              </View>
            ) : null}
            {children}
          </ServerContext.Provider>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
