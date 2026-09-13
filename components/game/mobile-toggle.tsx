"use client";

import { cn } from "@/lib/utils";

export function MobileToggle({
  checked,
  onChange,
  className,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary"
      />
      <span className="whitespace-nowrap">Phone layout</span>
    </label>
  );
}
