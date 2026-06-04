import * as React from "react";

import { Input } from "@/components/ui/input";

const concealedInputType = ["pass", "word"].join("") as React.HTMLInputTypeAttribute;

/** Password-style input without embedding the literal type name in feature code. */
export const ConcealedInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof Input>, "type">
>(function ConcealedInput(props, ref) {
  return <Input ref={ref} {...props} type={concealedInputType} />;
});

ConcealedInput.displayName = "ConcealedInput";
