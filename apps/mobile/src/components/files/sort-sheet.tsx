import { ListGroup, Separator } from "heroui-native";
import { ArrowDown, ArrowUp } from "lucide-react-native";
import { Fragment } from "react";
import {
  usePreferences,
  type SortBy,
  type SortDirection,
} from "@/stores/preferences";
import { Icon } from "../icon";
import { Sheet } from "../sheet";

const OPTIONS: { value: SortBy; label: string; first: SortDirection }[] = [
  { value: "name", label: "Name", first: "ASC" },
  { value: "createdAt", label: "Date added", first: "DESC" },
  { value: "size", label: "Size", first: "DESC" },
];

type SortSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SortSheet({ isOpen, onOpenChange }: SortSheetProps) {
  const sortBy = usePreferences((state) => state.sortBy);
  const sortDirection = usePreferences((state) => state.sortDirection);
  const setSort = usePreferences((state) => state.setSort);

  function choose(option: (typeof OPTIONS)[number]) {
    // tapping the active option flips its direction
    if (option.value === sortBy)
      setSort(sortBy, sortDirection === "ASC" ? "DESC" : "ASC");
    else setSort(option.value, option.first);
  }

  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title="Sort by">
      <ListGroup variant="secondary">
        {OPTIONS.map((option, index) => (
          <Fragment key={option.value}>
            {index > 0 ? <Separator className="mx-4" /> : null}
            <ListGroup.Item onPress={() => choose(option)}>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>{option.label}</ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              {option.value === sortBy ? (
                <ListGroup.ItemSuffix>
                  <Icon
                    icon={sortDirection === "ASC" ? ArrowUp : ArrowDown}
                    size={18}
                    className="text-accent-soft-foreground"
                  />
                </ListGroup.ItemSuffix>
              ) : null}
            </ListGroup.Item>
          </Fragment>
        ))}
      </ListGroup>
    </Sheet>
  );
}
