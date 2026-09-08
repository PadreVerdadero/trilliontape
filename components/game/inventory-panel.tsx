import { itemById } from "@/lib/game/catalog";
import { formatCoins, formatNumber } from "@/lib/game/format";
import { rarityClass } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import type { MarketPrice, PlayerState } from "@/lib/game/types";

export function InventoryPanel({
  player,
  prices,
  onSelect,
  selectedItemId,
}: {
  player: PlayerState;
  prices: MarketPrice[];
  onSelect?: (itemId: string) => void;
  selectedItemId?: string;
}) {
  return (
    <div>
      <div className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto_auto_auto] items-center gap-1.5 rounded-lg px-1.5 py-1.5 sm:px-2">
        <span className="text-base leading-none">🪙</span>
        <span className="truncate text-xs font-medium sm:text-sm">Coins</span>
        <span className="tabular-nums text-right text-xs font-medium text-primary sm:text-sm">
          {formatNumber(player.gold)}
        </span>
        <span className="tabular-nums text-right text-xs text-muted-foreground">—</span>
        <span className="tabular-nums text-right text-xs text-muted-foreground">—</span>
      </div>
      {player.inventory.length === 0 ? (
        <p className="px-2 py-2 text-xs leading-5 text-muted-foreground">No goods yet. Buy on the board.</p>
      ) : (
        player.inventory.map((row) => {
          const item = itemById[row.itemId];
          const reserved = player.reservedItems[row.itemId] ?? 0;
          const mv =
            prices.find((quote) => quote.itemId === row.itemId)?.vwap ?? item?.basePrice ?? 0;
          const total = row.quantity * mv;
          const active = selectedItemId === row.itemId;
          return (
            <button
              key={row.itemId}
              type="button"
              onClick={() => onSelect?.(row.itemId)}
              title={`${item?.name ?? row.itemId} · ${formatNumber(row.quantity)} × ${formatCoins(mv)} = ${formatCoins(total)}${
                reserved ? ` · ${formatNumber(reserved)} listed` : ""
              }`}
              className={cn(
                "grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto_auto_auto] items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-background/70 sm:px-2 sm:py-1.5",
                active && "bg-primary/15",
                rarityClass(row.itemId)
              )}
            >
              <span className="text-base leading-none">{item?.emoji}</span>
              <span className="truncate text-xs font-medium sm:text-sm">{item?.name}</span>
              <span className="tabular-nums text-right text-xs text-muted-foreground">
                {formatNumber(row.quantity)}
              </span>
              <span className="tabular-nums text-right text-xs font-medium text-sky-200">
                {formatCoins(mv)}
              </span>
              <span className="tabular-nums text-right text-xs font-medium sm:text-sm">
                {formatCoins(total)}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
