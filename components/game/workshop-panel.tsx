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
  const have = Object.fromEntries(player.inventory.map((row) => [row.itemId, row.quantity]));
  const reserved = player.reservedItems;

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted-foreground">
        Crafting is instant. Bake bread when you are hungry. The relic is worth 8 victory points
        when it comes off the bench. Side crafts (planks, salve, baskets, bricks, charms) are
        supplies you can use or sell to an open stall.
      </p>
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
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{output.purpose}</p>
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
                className="h-11 shrink-0 md:h-7"
                disabled={!ready || pending}
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
