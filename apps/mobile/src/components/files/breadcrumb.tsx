import { ChevronRight } from "lucide-react-native";
import { Fragment, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Icon } from "../icon";

type BreadcrumbProps = {
  folderKey: string;
  onNavigate: (folderKey: string) => void;
};

export function Breadcrumb({ folderKey, onNavigate }: BreadcrumbProps) {
  const scroller = useRef<ScrollView>(null);
  const names = folderKey.split("/");
  const crumbs = [
    { key: "", label: "Files" },
    ...names.map((name, index) => ({
      key: names.slice(0, index + 1).join("/"),
      label: name,
    })),
  ];

  // keeps the current folder in view on deep paths
  const showCurrent = () => scroller.current?.scrollToEnd({ animated: false });

  return (
    <View className="border-b border-border">
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="items-center gap-0.5 px-3.5 py-2"
        onContentSizeChange={showCurrent}
      >
        {crumbs.map((crumb, index) => (
          <Fragment key={`${index}:${crumb.label}`}>
            {index > 0 ? (
              <Icon icon={ChevronRight} size={14} className="text-muted" />
            ) : null}
            {index === crumbs.length - 1 ? (
              <Text
                numberOfLines={1}
                className="max-w-56 px-1.5 py-1 text-sm font-medium text-foreground"
              >
                {crumb.label}
              </Text>
            ) : (
              <Pressable
                onPress={() => onNavigate(crumb.key)}
                hitSlop={{ top: 8, bottom: 8 }}
                className="rounded-lg px-1.5 py-1 active:bg-default"
                accessibilityRole="link"
                accessibilityLabel={`Go to ${crumb.label}`}
              >
                <Text
                  numberOfLines={1}
                  className="max-w-40 font-normal text-sm text-muted"
                >
                  {crumb.label}
                </Text>
              </Pressable>
            )}
          </Fragment>
        ))}
      </ScrollView>
    </View>
  );
}
