import { itemById, items } from "@/lib/game/catalog";
import { formatCoins, formatCompact, formatNetWorth, formatNumber } from "@/lib/game/format";
import { rarityClass, rarityMapFromPrices } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import type { InventoryRow, MarketPrice, PlayerState } from "@/lib/game/types";

function packRows(inventory: InventoryRow[], rankedIds: string[]) {
  const held = new Map(inventory.map((row) => [row.itemId, row]));
  const ids = rankedIds.length > 0 ? rankedIds : items.map((item) => item.id);
  return ids.map((itemId) => {
    const stack = held.get(itemId);
    return {
      itemId,
      quantity: stack?.quantity ?? 0,
      avgCost: stack?.avgCost ?? null,
    };
  });
}

export function InventoryPanel({
  player,
  prices,
  onSelect,
  selectedItemId,
  rankedItemIds,
  coinVolume,
}: {
  player: PlayerState;
  prices: MarketPrice[];
  onSelect?: (itemId: string) => void;
  selectedItemId?: string;
  rankedItemIds: string[];
  coinVolume: number;
}) {
  const rarityMap = rarityMapFromPrices(
    items.map((item) => item.id),
    prices
  );
  const rows = packRows(player.inventory, rankedItemIds);
  const goods = rows.reduce((sum, row) => {
    const mv =
      prices.find((quote) => quote.itemId === row.itemId)?.vwap ?? itemById[row.itemId]?.basePrice ?? 0;
    return sum + row.quantity * mv;
  }, 0);
  const net = player.gold + goods;
  return (
    <div>
      <div className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg px-1.5 py-1.5 sm:px-2">
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
          <span className="block">
            {formatNumber(player.availableGold)}
            {player.availableGold !== player.gold ? (
              <span className="text-muted-foreground">/{formatNumber(player.gold)}</span>
            ) : null}
          </span>
          <span
            className="block text-[10px] font-normal text-muted-foreground"
            title="Coins sitting in every purse on the desk"
          >
            Vol {formatNumber(coinVolume)}
          </span>
        </span>
      </div>
      {rows.map((row) => {
        const item = itemById[row.itemId];
        const reserved = player.reservedItems[row.itemId] ?? 0;
        const free = Math.max(0, row.quantity - reserved);
        const mv =
          prices.find((quote) => quote.itemId === row.itemId)?.vwap ?? item?.basePrice ?? 0;
        const total = row.quantity * mv;
        const active = selectedItemId === row.itemId;
        const empty = row.quantity <= 0;
        const avg = empty ? null : row.avgCost;
        return (
          <button
            key={row.itemId}
            type="button"
            data-pack-item={row.itemId}
            onClick={() => onSelect?.(row.itemId)}
            title={`${item?.name ?? row.itemId} · ${formatNumber(free)} free of ${formatNumber(row.quantity)}${
              reserved ? ` · ${formatNumber(reserved)} listed` : ""
            } · MV ${formatCoins(mv)}${avg != null ? ` · avg paid ${formatCoins(avg)}` : ""} = ${formatCoins(total)}`}
            className={cn(
              "grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-background/70 sm:px-2 sm:py-1.5",
              active && "bg-primary/15",
              empty && "opacity-60",
              rarityClass(row.itemId, rarityMap)
            )}
          >
            <span className="text-base leading-none">{item?.emoji}</span>
            <span className="truncate text-xs font-medium sm:text-sm">{item?.name}</span>
            <span className="tabular-nums text-right text-xs sm:text-sm">
              <span className="font-medium">{formatCompact(free)}</span>
              {reserved ? (
                <span className="text-muted-foreground">/{formatCompact(row.quantity)}</span>
              ) : null}
            </span>
            <span className="tabular-nums text-right text-xs font-medium text-sky-200">
              {formatCompact(mv)}
            </span>
            <span
              className={cn(
                "tabular-nums text-right text-xs font-medium",
                avg == null
                  ? "text-muted-foreground"
                  : avg < mv
                    ? "text-emerald-200"
                    : avg > mv
                      ? "text-rose-200"
                      : "text-amber-200"
              )}
              title="Average price you paid for units you still hold"
            >
              {avg == null ? "—" : formatCompact(avg)}
            </span>
            <span className="tabular-nums text-right text-xs font-medium sm:text-sm">
              {empty ? "—" : formatCompact(total)}
            </span>
          </button>
        );
      })}
      <div className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg px-1.5 py-1.5 sm:px-2">
        <span className="text-base leading-none">💰</span>
        <span className="truncate text-xs font-medium sm:text-sm">Net worth</span>
        <span
          className="tabular-nums text-right text-xs font-medium text-primary sm:text-sm"
          title={`${formatNetWorth(net)} · ${formatCoins(player.gold)} coin · ${formatCoins(goods)} goods`}
        >
          <span className="block">{formatNumber(net)}</span>
          <span className="block text-[10px] font-normal text-muted-foreground">
            {formatNumber(player.gold)}🪙 · {formatNumber(goods)} goods
          </span>
        </span>
      </div>
    </div>
  );
}

