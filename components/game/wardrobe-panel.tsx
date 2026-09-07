import { Button } from "@/components/ui/button";
import { cosmetics } from "@/lib/game/catalog";
import { formatCoins } from "@/lib/game/format";
import type { PlayerState } from "@/lib/game/types";

export function WardrobePanel({
  player,
  pending,
  onBuy,
  onEquip,
}: {
  player: PlayerState;
  pending: boolean;
  onBuy: (cosmeticId: string) => void;
  onEquip: (cosmeticId: string | null, slot: string) => void;
}) {
  const slots = ["hat", "outfit", "accessory"] as const;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Cosmetics do not help you forage. The first look you equip in each slot is +1 VP. They
        tell the plaza you have coin, taste, or both.
      </p>
      {slots.map((slot) => (
        <div key={slot} className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {slot}
          </p>
          <div className="grid gap-2">
            {cosmetics
              .filter((item) => item.slot === slot)
              .map((item) => {
                const owned = player.cosmetics.includes(item.id);
                const equipped = player.equipped[slot] === item.id;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-background/40 p-3 ring-1 ring-foreground/10"
                  >
                    <div>
                      <p className="font-medium">
                        {item.emoji} {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    {owned ? (
                      <Button
                        size="sm"
                        className="h-11 shrink-0 md:h-7"
                        variant={equipped ? "secondary" : "outline"}
                        disabled={pending}
                        onClick={() => onEquip(equipped ? null : item.id, slot)}
                      >
                        {equipped ? "Remove" : "Wear"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-11 shrink-0 md:h-7"
                        disabled={pending || player.availableGold < item.price}
                        onClick={() => onBuy(item.id)}
                      >
                        {formatCoins(item.price)}
                      </Button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
