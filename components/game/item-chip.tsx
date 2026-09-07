import { itemById } from "@/lib/game/catalog";
import { rarityClass, rarityLabel, rarityOf, rarityText } from "@/lib/game/rarity";
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
  const rarity = rarityOf(itemId);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-background/40 px-2 py-0.5 text-xs ring-1",
        rarityClass(itemId),
        muted && "opacity-60",
        className
      )}
      title={`${item.purpose} · ${rarityLabel[rarity]}`}
    >
      <span aria-hidden className="text-sm">
        {item.emoji}
      </span>
      <span className="font-medium">{item.name}</span>
      {qty != null ? <span className="text-muted-foreground">×{qty}</span> : null}
      <span className={cn("text-[10px] tracking-wide", rarityText[rarity])}>
        {rarityLabel[rarity]}
      </span>
    </span>
  );
}
