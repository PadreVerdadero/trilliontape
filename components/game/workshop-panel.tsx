import { Button } from "@/components/ui/button";
import { itemById, recipes, WIN_ITEM_ID } from "@/lib/game/catalog";
import { ItemChip } from "@/components/game/item-chip";
import { rarityClass, rarityLabel, rarityOf, rarityText } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import type { PlayerState } from "@/lib/game/types";

export function WorkshopPanel({
  player,
  pending,
  onCraft,
}: {
  player: PlayerState;
  pending: boolean;
  onCraft: (outputId: string) => void;
}) {
  const inTown = player.locationId === "town" && player.busy.type === "idle";
  const have = Object.fromEntries(player.inventory.map((row) => [row.itemId, row.quantity]));
  const reserved = player.reservedItems;

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted-foreground">
        Crafting is instant and only happens in Lantern Plaza. Ingredients sitting on sell orders
        do not count.
      </p>
      {!inTown ? (
        <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-sm">
          Walk back to 🏮 Lantern Plaza to use the workshop.
        </p>
      ) : null}
      {recipes.map((recipe) => {
        const output = itemById[recipe.outputId];
        const ready = recipe.inputs.every((input) => {
          const free = (have[input.itemId] ?? 0) - (reserved[input.itemId] ?? 0);
          return free >= input.qty;
        });
        return (
          <div
            key={recipe.id}
            className={cn(
              "rounded-xl bg-background/40 p-3 ring-1",
              rarityClass(recipe.outputId),
              recipe.outputId === WIN_ITEM_ID && "bg-primary/10"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {output.emoji} {output.name}{" "}
                  <span className={cn("text-[10px] uppercase tracking-wide", rarityText[rarityOf(recipe.outputId)])}>
                    {rarityLabel[rarityOf(recipe.outputId)]}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {recipe.inputs.map((input) => {
                    const free = (have[input.itemId] ?? 0) - (reserved[input.itemId] ?? 0);
                    return (
                      <ItemChip
                        key={input.itemId}
                        itemId={input.itemId}
                        qty={input.qty}
                        muted={free < input.qty}
                      />
                    );
                  })}
                </div>
              </div>
              <Button
                size="sm"
                disabled={!inTown || !ready || pending}
                onClick={() => onCraft(recipe.outputId)}
              >
                Craft
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
