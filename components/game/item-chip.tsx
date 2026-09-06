import { itemById } from "@/lib/game/catalog";
import { cn } from "@/lib/utils";

export function ItemChip({
  itemId,
  qty,
  className,
  muted,
}: {
  itemId: string;
  qty?: number;
  className?: string;
  muted?: boolean;
}) {
  const item = itemById[itemId];
  if (!item) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/40 px-2 py-0.5 text-xs",
        muted && "opacity-60",
        className
      )}
    >
      <span aria-hidden className="text-sm">
        {item.emoji}
      </span>
      <span className="font-medium">{item.name}</span>
      {qty != null ? <span className="text-muted-foreground">×{qty}</span> : null}
    </span>
  );
}
