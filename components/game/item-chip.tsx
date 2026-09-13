import { ItemIcon } from "@/components/game/item-icon";
import { playItemMap } from "@/lib/game/shares";
import type { Item } from "@/lib/game/types";
import { formatNumber } from "@/lib/game/format";
import { rarityClass, rarityLabel, rarityOf, rarityText, type RarityMap } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";

export function ItemChip({
  itemId,
  qty,
  className,
  muted,
  rarityMap,
  catalog,
}: {
  itemId: string;
  qty?: number;
  className?: string;
  muted?: boolean;
  rarityMap?: RarityMap;
  catalog?: Item[];
}) {
  const item = playItemMap(catalog)[itemId];
  if (!item) return null;
  const rarity = rarityOf(itemId, rarityMap);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-background/40 px-2 py-0.5 text-xs ring-1",
        rarityClass(itemId, rarityMap),
        muted && "opacity-60",
        className
      )}
      title={`${item.purpose} · ${rarityLabel[rarity]}`}
    >
      <span aria-hidden className="text-sm">
        <ItemIcon item={item} />
      </span>
      <span className="font-medium">{item.name}</span>
      {qty != null ? <span className="text-muted-foreground">×{formatNumber(qty)}</span> : null}
      <span className={cn("text-[10px] tracking-wide", rarityText[rarity])}>
        {rarityLabel[rarity]}
      </span>
    </span>
  );
}
