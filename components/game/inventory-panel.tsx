import { itemById, items, NET_WORTH_GOAL } from "@/lib/game/catalog";
import { formatCoins, formatCompact, formatNetWorth, formatNumber } from "@/lib/game/format";
import { rarityClass, rarityMapFromPrices } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import type { InventoryRow, MarketPrice, PlayerState } from "@/lib/game/types";

const PACK_PAD = "px-1.5 sm:px-2";
const PACK_GRID =
  `grid w-full grid-cols-[1.25rem_minmax(0,1fr)_2.7rem_2.35rem_2.35rem_2.7rem] items-center gap-x-1.5 ${PACK_PAD} sm:grid-cols-[1.25rem_minmax(0,1fr)_3.1rem_2.7rem_2.7rem_3.2rem] lg:grid-cols-[1.25rem_minmax(0,1fr)_3.4rem_2.9rem_2.9rem_3.5rem]`;
const PACK_SOLO =
  `grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-1.5 ${PACK_PAD}`;

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

function cell(value: string, className?: string) {
  return (
    <span className={cn("min-w-0 truncate text-right tabular-nums text-xs sm:text-sm", className)}>
      {value}
    </span>
  );
}

export function InventoryPanel({
  player,
  prices,
  onSelect,
  selectedItemId,
  rankedItemIds,
  coinVolume,
  goalLabel,
}: {
  player: PlayerState;
  prices: MarketPrice[];
  onSelect?: (itemId: string) => void;
  selectedItemId?: string;
  rankedItemIds: string[];
  coinVolume: number;
  goalLabel?: string;
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
      <div
        className={cn(
          PACK_GRID,
          "border-b border-border/60 py-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
        )}
      >
        <span />
        <span>Item</span>
        <span className="text-right" title="Free to trade — not sitting on a bid or ask">
          Free
        </span>
        <span className="text-right">MV</span>
        <span className="text-right" title="Average price you paid for units you still hold">
          Avg
        </span>
        <span className="text-right">Total</span>
      </div>
      <div className={cn(PACK_SOLO, "rounded-lg py-1.5")}>
        <span className="text-base leading-none">🪙</span>
        <span className="min-w-0 truncate text-xs font-medium sm:text-sm">Coins</span>
        <span
          className="text-right text-xs font-medium text-primary sm:text-sm"
          title={
            player.availableGold !== player.gold
              ? `${formatNumber(player.availableGold)} free · ${formatNumber(player.gold - player.availableGold)} on bids`
              : `${formatNumber(player.availableGold)} free`
          }
        >
          <span className="block tabular-nums">
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
              PACK_GRID,
              "rounded-lg py-1 text-left hover:bg-background/70 sm:py-1.5",
              active && "bg-primary/15",
              empty && "opacity-60",
              rarityClass(row.itemId, rarityMap)
            )}
          >
            <span className="text-base leading-none">{item?.emoji}</span>
            <span className="truncate text-xs font-medium sm:text-sm">{item?.name}</span>
            <span className="min-w-0 truncate text-right tabular-nums text-xs sm:text-sm">
              <span className="font-medium">{formatCompact(free)}</span>
              {reserved ? (
                <span className="text-muted-foreground">/{formatCompact(row.quantity)}</span>
              ) : null}
            </span>
            {cell(formatCompact(mv), "font-medium text-sky-200")}
            {cell(
              avg == null ? "—" : formatCompact(avg),
              cn(
                "font-medium",
                avg == null
                  ? "text-muted-foreground"
                  : avg < mv
                    ? "text-emerald-200"
                    : avg > mv
                      ? "text-rose-200"
                      : "text-amber-200"
              )
            )}
            {cell(empty ? "—" : formatCompact(total), "font-medium")}
          </button>
        );
      })}
      <div className={cn(PACK_SOLO, "rounded-lg py-1.5")}>
        <span className="text-base leading-none">💰</span>
        <span className="min-w-0 truncate text-xs font-medium sm:text-sm">Net worth</span>
        <span
          className="text-right text-xs font-medium text-primary sm:text-sm"
          title={`${formatNetWorth(net)} · ${formatCoins(player.gold)} coin · ${formatCoins(goods)} goods`}
        >
          <span className="block tabular-nums">{formatNumber(net)}</span>
          <span className="block text-[10px] font-normal text-muted-foreground">
            {goalLabel ? `${goalLabel} · ` : `Goal ${formatCompact(NET_WORTH_GOAL)} · `}
            {formatNumber(player.gold)}🪙 ·{" "}
            {formatNumber(goods)} goods
          </span>
        </span>
      </div>
    </div>
  );
}
