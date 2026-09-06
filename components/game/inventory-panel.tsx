import { itemById } from "@/lib/game/catalog";
import type { PlayerState } from "@/lib/game/types";

export function InventoryPanel({
  player,
  onSelect,
}: {
  player: PlayerState;
  onSelect?: (itemId: string) => void;
}) {
  if (player.inventory.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Your pack is empty. Gather in the wilds, fill a bid on the board, or bake the wheat you
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
        return (
          <button
            key={row.itemId}
            type="button"
            onClick={() => onSelect?.(row.itemId)}
            className="rounded-xl bg-background/40 p-2 text-left ring-1 ring-foreground/10 transition hover:bg-background/70"
          >
            <div className="text-2xl">{item?.emoji}</div>
            <div className="truncate text-sm font-medium">{item?.name}</div>
            <div className="text-xs text-muted-foreground">
              {free}
              {reserved ? ` free · ${reserved} listed` : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}
