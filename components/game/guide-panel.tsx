import { items, recipes, WIN_ITEM_ID } from "@/lib/game/catalog";
import { ItemChip } from "@/components/game/item-chip";

const places = [
  { title: "🌲 Woods", ids: ["wood", "berries", "herbs", "mushrooms"] },
  { title: "⛰️ Ridge", ids: ["stone", "iron", "coal", "gem"] },
  { title: "🏖️ Shore", ids: ["fish", "shell", "salt", "coral"] },
  { title: "🌾 Fields", ids: ["wheat", "flax", "honey", "flower"] },
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
          Check in at a stop (scan a QR, or tap I&apos;m here). Search costs energy and pays out
          at once. Crowds make the next pull cost more until that place sits quiet for 45
          seconds. Eat food to refill. Craft and trade in Lantern Plaza. Win by crafting the
          Celestial Relic.
        </p>
        <p>
          Every emoji has one job: eat it, use it, or craft it into something. The bank only
          buys, at 50% of market value. The board is a real order book — crossing trades clear
          at the ask.
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="font-heading text-foreground">How to win</h3>
        <p>{relicItem?.purpose}</p>
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
          <span className="text-violet-300">purple Unique</span>,{" "}
          <span className="text-red-400">red Legendary</span>.
        </p>
      </section>
    </div>
  );
}
