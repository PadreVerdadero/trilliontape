import { itemById, items } from "@/lib/game/catalog";
import { formatCoins, formatNumber } from "@/lib/game/format";
import { orderIndex } from "@/lib/game/market-sort";
import { rarityClass, rarityMapFromPrices } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import type { InventoryRow, MarketPrice, PlayerState } from "@/lib/game/types";

function sortPackRows(rows: InventoryRow[], rankedIds: string[]) {
  const rank = orderIndex(rankedIds);
  return [...rows].sort((a, b) => {
    const ia = rank.get(a.itemId) ?? Number.MAX_SAFE_INTEGER;
    const ib = rank.get(b.itemId) ?? Number.MAX_SAFE_INTEGER;
    if (ia !== ib) return ia - ib;
    return a.itemId.localeCompare(b.itemId);
  });
}

export function InventoryPanel({
  player,
  prices,
  onSelect,
  selectedItemId,
  rankedItemIds,
}: {
  player: PlayerState;
  prices: MarketPrice[];
  onSelect?: (itemId: string) => void;
  selectedItemId?: string;
  rankedItemIds: string[];
}) {
  const rarityMap = rarityMapFromPrices(
    items.map((item) => item.id),
    prices
  );
  const packRows = sortPackRows(player.inventory, rankedItemIds);
  return (
    <div>
      <div className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto_auto_auto] items-center gap-1.5 rounded-lg px-1.5 py-1.5 sm:px-2">
        <span className="text-base leading-none">🪙</span>
        <span className="truncate text-xs font-medium sm:text-sm">Coins</span>
        <span
          className="tabular-nums text-right text-xs font-medium text-primary sm:text-sm"
          title={
            player.availableGold !== player.gold
              ? `${formatNumber(player.availableGold)} free · ${formatNumber(player.gold - player.availableGold)} on bids`
              : `${formatNumber(player.availableGold)} free`
          }
        >
          {formatNumber(player.availableGold)}
          {player.availableGold !== player.gold ? (
            <span className="text-muted-foreground">/{formatNumber(player.gold)}</span>
          ) : null}
        </span>
        <span className="tabular-nums text-right text-xs text-muted-foreground">—</span>
        <span className="tabular-nums text-right text-xs text-muted-foreground">
          {player.isGov ? "∞" : "—"}
        </span>
      </div>
      {packRows.length === 0 ? (
        <p className="px-2 py-2 text-xs leading-5 text-muted-foreground">No goods yet. Buy on the board.</p>
      ) : (
        packRows.map((row) => {
          const item = itemById[row.itemId];
          const reserved = player.reservedItems[row.itemId] ?? 0;
          const free = Math.max(0, row.quantity - reserved);
          const mv =
            prices.find((quote) => quote.itemId === row.itemId)?.vwap ?? item?.basePrice ?? 0;
          const total = row.quantity * mv;
          const active = selectedItemId === row.itemId;
          return (
            <button
              key={row.itemId}
              type="button"
              data-pack-item={row.itemId}
              onClick={() => onSelect?.(row.itemId)}
              title={`${item?.name ?? row.itemId} · ${formatNumber(free)} free of ${formatNumber(row.quantity)}${
                reserved ? ` · ${formatNumber(reserved)} listed` : ""
              } · ${formatCoins(mv)} each = ${formatCoins(total)}`}
              className={cn(
                "grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto_auto_auto] items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-background/70 sm:px-2 sm:py-1.5",
                active && "bg-primary/15",
                rarityClass(row.itemId, rarityMap)
              )}
            >
              <span className="text-base leading-none">{item?.emoji}</span>
              <span className="truncate text-xs font-medium sm:text-sm">{item?.name}</span>
              <span className="tabular-nums text-right text-xs sm:text-sm">
                <span className="font-medium">{formatNumber(free)}</span>
                {reserved ? (
                  <span className="text-muted-foreground">/{formatNumber(row.quantity)}</span>
                ) : null}
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
