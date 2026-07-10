import { type ComponentPropsWithoutRef, forwardRef } from "react";

import { cn } from "@/lib/utils";

/**
 * A lightweight scroll container that uses the browser's native scrollbar
 * with `scrollbar-width: thin` styling (via the `.custom-scrollbar` class).
 *
 * Drop-in replacement for the Base UI `ScrollArea` — accepts the same
 * `className` / `children` / spread-props API.
 */
const NativeScrollArea = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="native-scroll-area"
    className={cn("overflow-auto custom-scrollbar", className)}
    {...props}
  >
    {children}
  </div>
));

NativeScrollArea.displayName = "NativeScrollArea";

export { NativeScrollArea };
