import { Button } from "@/components/ui/button";
import { itemById } from "@/lib/game/catalog";
import { usableById } from "@/lib/game/consumables";
import { rarityClass, rarityLabel, rarityOf, rarityText } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import type { PlayerState } from "@/lib/game/types";

export function InventoryPanel({
  player,
  pending,
  onSelect,
  onUse,
}: {
  player: PlayerState;
  pending?: boolean;
  onSelect?: (itemId: string) => void;
  onUse?: (itemId: string) => void;
}) {
  if (player.inventory.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Your pack is empty. Search the wilds, fill a bid on the board, or bake the wheat you
        arrived with.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {player.inventory.map((row) => {
        const item = itemById[row.itemId];
        const reserved = player.reservedItems[row.itemId] ?? 0;
        const free = row.quantity - reserved;
        const rarity = rarityOf(row.itemId);
        const usable = usableById(row.itemId);
        return (
          <div
            key={row.itemId}
            className={cn(
              "rounded-xl bg-background/40 p-2 text-left ring-1",
              rarityClass(row.itemId)
            )}
          >
            <button
              type="button"
              onClick={() => onSelect?.(row.itemId)}
              className="w-full text-left"
            >
              <div className="text-2xl">{item?.emoji}</div>
              <div className="truncate text-sm font-medium">{item?.name}</div>
              <div className={cn("text-[10px] uppercase tracking-wide", rarityText[rarity])}>
                {rarityLabel[rarity]}
              </div>
              <div className="text-xs text-muted-foreground">
                {free}
                {reserved ? ` free · ${reserved} listed` : ""}
              </div>
            </button>
            {usable && free > 0 ? (
              <Button
                size="xs"
                variant="secondary"
                className="mt-2 h-11 w-full md:h-6"
                disabled={pending}
                title={usable.blurb}
                onClick={() => onUse?.(row.itemId)}
              >
                {usable.verb}
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
