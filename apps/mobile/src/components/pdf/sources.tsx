import { useToast } from "heroui-native";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react-native";
import { Fragment, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import {
  SourceRow,
  type SourceOrigin,
} from "@/components/conversion/conversion-parts";
import { FilePickerSheet } from "@/components/conversion/file-picker-sheet";
import { Icon } from "@/components/icon";
import type { ConversionSource } from "@/lib/conversion";
import { discardPicked, pickFiles } from "@/lib/transfer";

type Kind = "image" | "pdf" | "document";

const PICKER_ERRORS: Record<Kind, string> = {
  image: "Couldn't open your images",
  pdf: "Couldn't open your PDFs",
  document: "Couldn't open your documents",
};

/** Picks files of a kind from the phone or from Vaze; `sheet` must be rendered. */
export function useSourcePicker(
  kind: Kind,
  {
    multiple,
    onPicked,
  }: { multiple: boolean; onPicked: (source: ConversionSource) => void },
) {
  const { toast } = useToast();
  const [picking, setPicking] = useState(false);

  async function pick(origin: SourceOrigin) {
    if (origin === "vaze") return setPicking(true);
    try {
      const files = await pickFiles(kind, origin, { multiple });
      for (const file of files) onPicked({ kind: "device", file });
    } catch (error) {
      toast.show({
        variant: "danger",
        label: PICKER_ERRORS[kind],
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  const sheet = (
    <FilePickerSheet
      kind={kind}
      isOpen={picking}
      onOpenChange={setPicking}
      onSelect={(file) => {
        setPicking(false);
        onPicked({ kind: "vaze", file });
      }}
    />
  );

  return { pick, sheet };
}

const discardSource = (source: ConversionSource) => {
  if (source.kind === "device") discardPicked(source.file.uri);
};

/** One picked file, whose copy in the app's cache goes once it is replaced or the screen closes. */
export function useSource(onChange: () => void) {
  const [source, setSource] = useState<ConversionSource | null>(null);
  const current = useRef<ConversionSource | null>(null);

  useEffect(
    () => () => {
      if (current.current) discardSource(current.current);
    },
    [],
  );

  function choose(next: ConversionSource | null) {
    if (current.current && current.current !== next) {
      discardSource(current.current);
    }
    current.current = next;
    setSource(next);
    onChange();
  }

  return { source, choose };
}

export type ListedSource = {
  /** The same file can be picked twice, so each pick has a key of its own. */
  key: number;
  source: ConversionSource;
};

/** An ordered list of picked files, the order the result follows. */
export function useSourceList(onChange: () => void) {
  const [items, setItems] = useState<ListedSource[]>([]);
  const nextKey = useRef(0);
  const latest = useRef<ListedSource[]>([]);

  useEffect(() => {
    latest.current = items;
  }, [items]);

  useEffect(
    () => () => {
      for (const item of latest.current) discardSource(item.source);
    },
    [],
  );

  const update = (next: (items: ListedSource[]) => ListedSource[]) => {
    setItems(next);
    onChange();
  };

  return {
    items,
    sources: items.map((item) => item.source),
    add: (source: ConversionSource) =>
      update((items) => [...items, { key: nextKey.current++, source }]),
    remove: (key: number) =>
      update((items) => {
        const gone = items.find((item) => item.key === key);
        if (gone) discardSource(gone.source);
        return items.filter((item) => item.key !== key);
      }),
    move: (key: number, by: -1 | 1) =>
      update((items) => {
        const from = items.findIndex((item) => item.key === key);
        const to = from + by;
        if (from < 0 || to < 0 || to >= items.length) return items;
        const next = [...items];
        [next[from], next[to]] = [next[to], next[from]];
        return next;
      }),
    clear: () =>
      update((items) => {
        for (const item of items) discardSource(item.source);
        return [];
      }),
  };
}

function MoveButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      className="size-8 items-center justify-center rounded-xl active:bg-default"
      style={{ opacity: disabled ? 0.35 : 1 }}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Icon icon={icon} size={18} className="text-muted" />
    </Pressable>
  );
}

/** The picked files in order, each movable up or down and removable while nothing runs. */
export function SourceListRows({
  list,
  icon,
  showDeviceImage = false,
  busy,
}: {
  list: ReturnType<typeof useSourceList>;
  icon: LucideIcon;
  showDeviceImage?: boolean;
  busy: boolean;
}) {
  return (
    <View className="gap-3">
      {list.items.map(({ key, source }, index) => (
        <Fragment key={key}>
          <SourceRow
            source={source}
            icon={icon}
            showDeviceImage={showDeviceImage}
            removeLabel={`Remove ${source.file.name}`}
            onRemove={busy ? undefined : () => list.remove(key)}
            actions={
              <View className="flex-row">
                <MoveButton
                  icon={ArrowUp}
                  label={`Move ${source.file.name} up`}
                  disabled={busy || index === 0}
                  onPress={() => list.move(key, -1)}
                />
                <MoveButton
                  icon={ArrowDown}
                  label={`Move ${source.file.name} down`}
                  disabled={busy || index === list.items.length - 1}
                  onPress={() => list.move(key, 1)}
                />
              </View>
            }
          />
        </Fragment>
      ))}
    </View>
  );
}
