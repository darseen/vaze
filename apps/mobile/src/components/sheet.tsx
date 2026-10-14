import { BottomSheet } from "heroui-native";
import { useContext, type ReactNode } from "react";
import { View } from "react-native";
import { ServerContext } from "./server-context";

type SheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  /** Fixed height for content that scrolls in a `BottomSheetScrollView`. */
  scrollable?: boolean;
  children: ReactNode;
};

export function Sheet({
  isOpen,
  onOpenChange,
  title,
  description,
  scrollable = false,
  children,
}: SheetProps) {
  // portal content renders at the app root, outside this screen's providers
  const server = useContext(ServerContext);

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          keyboardBehavior="interactive"
          {...(scrollable
            ? {
                snapPoints: ["70%"],
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
