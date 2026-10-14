import { ListGroup, Separator, Spinner, cn } from "heroui-native";
import type { LucideIcon } from "lucide-react-native";
import { Fragment } from "react";
import { Icon } from "./icon";

export type Action = {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  description?: string;
  danger?: boolean;
  hidden?: boolean;
  busy?: boolean;
};

export function ActionGroup({
  actions,
  className,
}: {
  actions: Action[];
  className?: string;
}) {
  const visible = actions.filter((action) => !action.hidden);
  if (visible.length === 0) return null;

  return (
    <ListGroup variant="secondary" className={className}>
      {visible.map((action, index) => (
        <Fragment key={action.label}>
          {index > 0 ? <Separator className="mx-4" /> : null}
          <ListGroup.Item onPress={action.onPress} disabled={action.busy}>
            <ListGroup.ItemPrefix>
              <Icon
                icon={action.icon}
                className={action.danger ? "text-danger" : "text-foreground"}
              />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle
                className={cn(action.danger && "text-danger")}
              >
                {action.label}
              </ListGroup.ItemTitle>
              {action.description ? (
                <ListGroup.ItemDescription>
                  {action.description}
                </ListGroup.ItemDescription>
              ) : null}
            </ListGroup.ItemContent>
            {action.busy ? (
              <ListGroup.ItemSuffix>
                <Spinner size="sm" />
              </ListGroup.ItemSuffix>
            ) : null}
          </ListGroup.Item>
        </Fragment>
      ))}
    </ListGroup>
  );
}
