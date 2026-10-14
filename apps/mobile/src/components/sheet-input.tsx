import {
  Input,
  useBottomSheetAwareHandlers,
  type InputProps,
  type InputRef,
} from "heroui-native";
import type { Ref } from "react";

/** An input that keeps itself above the keyboard inside a bottom sheet. */
export function SheetInput({
  onFocus,
  onBlur,
  ...props
}: InputProps & { ref?: Ref<InputRef> }) {
  const handlers = useBottomSheetAwareHandlers();

  return (
    <Input
      variant="secondary"
      {...props}
      onFocus={(event) => {
        handlers.onFocus(event);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        handlers.onBlur(event);
        onBlur?.(event);
      }}
    />
  );
}
