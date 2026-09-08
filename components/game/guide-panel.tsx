import { items, recipes, WIN_ITEM_ID } from "@/lib/game/catalog";
import { stalls } from "@/lib/game/stalls";
import { ItemChip } from "@/components/game/item-chip";

const places = [
  { title: "🌲 Woods lean", ids: ["wood", "berries", "herbs", "mushrooms"] },
  { title: "⛰️ Ridge lean", ids: ["stone", "iron", "coal", "gem"] },
  { title: "🏖️ Shore lean", ids: ["fish", "shell", "salt", "coral"] },
  { title: "🌾 Fields lean", ids: ["wheat", "flax", "honey", "flower"] },
  {
    title: "🏮 Crafted",
    ids: ["bread", "planks", "salve", "basket", "brick", "charm", "candle", "stew", "blade", "jewel"],
  },
] as const;

export function GuidePanel() {
  const relic = recipes.find((recipe) => recipe.outputId === WIN_ITEM_ID);
  const relicItem = items.find((item) => item.id === WIN_ITEM_ID);

  return (
    <div className="space-y-5 text-sm leading-6 text-muted-foreground">
      <section className="space-y-2">
        <h3 className="font-heading text-foreground">How the plaza works</h3>
        <p>
          Forage the grounds for energy. Eat food to refill. Craft in Plaza. The player market is
          open all day. Shop owners buy at a markup only while their door is open — hours follow
          your phone clock.
        </p>
        <p>
          First to 20 victory points lights the festival. Contracts, chalkboard hours, board
          trades, and lantern donations all score. The relic is 8 points when you
          craft it — a fat contract, not the only path.
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="font-heading text-foreground">Market value</h3>
        <p>
          MV is the simple average of the last 100 board trades for that item. Each print counts
          equally. If nobody has traded it yet, MV is the catalog price. You may post a bid or ask
          at any whole-coin price of 1 or more — there is no collar. Each item shows how many units
          are listed for sale, how many sit on bids, and how many live in packs. Direct bundle deals
          (several items plus gold, named or open) do not print on the tape, so they do not move MV.
          Plaza regulars (Piper, Reed, Anvil, and the rest) keep a live book so the plaza is never empty.
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="font-heading text-foreground">Stall hours</h3>
        <ul className="space-y-1">
          {stalls.map((stall) => (
            <li key={stall.id}>
              <span className="text-foreground">
                {stall.emoji} {stall.name}
              </span>
              {" · "}
              {stall.hoursLabel} Sunday market (10:00–14:00) opens everyone.
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="font-heading text-foreground">The relic contract</h3>
        <p>{relicItem?.purpose} Worth 8 VP.</p>
        {relic ? (
          <div className="flex flex-wrap gap-1">
            {relic.inputs.map((input) => (
              <ItemChip key={input.itemId} itemId={input.itemId} qty={input.qty} />
            ))}
          </div>
        ) : null}
      </section>
      <section className="space-y-3">
        <h3 className="font-heading text-foreground">What each item does</h3>
        {places.map((place) => (
          <div key={place.title} className="space-y-1.5">
            <p className="text-xs font-medium tracking-wide text-foreground uppercase">
              {place.title}
            </p>
            <ul className="space-y-1">
              {place.ids.map((id) => {
                const item = items.find((entry) => entry.id === id);
                if (!item) return null;
                return (
                  <li key={id} className="flex gap-2 text-xs leading-5">
                    <span className="w-5 shrink-0 text-sm">{item.emoji}</span>
                    <span>
                      <span className="text-foreground">{item.name}.</span> {item.purpose}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {relicItem ? (
          <p className="text-xs leading-5">
            <span className="text-sm">{relicItem.emoji}</span>{" "}
            <span className="text-foreground">{relicItem.name}.</span> {relicItem.purpose}
          </p>
        ) : null}
      </section>
      <section className="space-y-2">
        <h3 className="font-heading text-foreground">Rarity</h3>
        <p>
          Borders tell the story: <span className="text-white/80">white Common</span>,{" "}
          <span className="text-emerald-300">green Uncommon</span>,{" "}
          <span className="text-sky-300">blue Rare</span>,{" "}
          <span className="text-red-400">red Legendary</span>.
        </p>
      </section>
    </div>
  );
}
