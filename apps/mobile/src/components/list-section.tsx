import { cn, ListGroup, Separator } from "heroui-native";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { Fragment, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Icon } from "./icon";

export type ListRow = {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  description?: string;
  /** Shown before the chevron, such as the current value. */
  value?: string;
  danger?: boolean;
  hidden?: boolean;
  /** False for rows that act in place instead of opening a page. */
  chevron?: boolean;
};

type ListSectionProps = {
  title?: string;
  footer?: string;
  rows?: ListRow[];
  /** Replaces the rows, for content that isn't a list of links. */
  children?: ReactNode;
};

/** A titled group of rows on a screen, like the server list. */
export function ListSection({
  title,
  footer,
  rows = [],
  children,
}: ListSectionProps) {
  const visible = rows.filter((row) => !row.hidden);
  if (visible.length === 0 && !children) return null;

  return (
    <View className="gap-2">
      {title ? (
        <Text className="px-1 text-xs font-medium uppercase text-muted">
          {title}
        </Text>
      ) : null}
      {children ?? (
        <ListGroup className="border border-border">
          {visible.map((row, index) => (
            <Fragment key={row.label}>
              {index > 0 ? <Separator className="mx-4" /> : null}
              <ListGroup.Item onPress={row.onPress}>
                <ListGroup.ItemPrefix>
                  <Icon
                    icon={row.icon}
                    className={row.danger ? "text-danger" : "text-foreground"}
                  />
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle
                    className={cn(row.danger && "text-danger")}
                  >
                    {row.label}
                  </ListGroup.ItemTitle>
                  {row.description ? (
                    <ListGroup.ItemDescription numberOfLines={1}>
                      {row.description}
                    </ListGroup.ItemDescription>
                  ) : null}
                </ListGroup.ItemContent>
                {row.value ? (
                  <ListGroup.ItemSuffix>
                    <View className="flex-row items-center gap-1">
                      <Text className="font-normal text-sm text-muted">
                        {row.value}
                      </Text>
                      {row.chevron === false ? null : (
                        <Icon
                          icon={ChevronRight}
                          size={18}
                          className="text-muted"
                        />
                      )}
                    </View>
                  </ListGroup.ItemSuffix>
                ) : row.chevron === false ? null : (
                  <ListGroup.ItemSuffix />
                )}
              </ListGroup.Item>
            </Fragment>
          ))}
        </ListGroup>
      )}
      {footer ? (
        <Text className="font-normal px-1 text-xs text-muted">{footer}</Text>
      ) : null}
    </View>
  );
}
