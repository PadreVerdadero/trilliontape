import { items, recipes, WIN_ITEM_ID } from "@/lib/game/catalog";
import { ItemChip } from "@/components/game/item-chip";

export function GuidePanel() {
  const relic = recipes.find((recipe) => recipe.outputId === WIN_ITEM_ID);

  return (
    <div className="space-y-5 text-sm leading-6 text-muted-foreground">
      <section className="space-y-2">
        <h3 className="font-heading text-foreground">Why this is fun</h3>
        <p>
          You are not clicking a win button. You are choosing a life: ridge miner, shore diver,
          field beekeeper, or plaza trader. Search an area and you pull a random find — gems and
          coral are just unlucky (or lucky). If several people comb the same biome, each search
          gets slower until that place sits quiet for 45 seconds.
        </p>
        <p>
          The market is the social game. Undercut an ask. Park a bid under the bank average and
          wait. If two orders cross, the seller&apos;s lower price wins — so aggressive bids lift
          stock instead of overpaying.
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="font-heading text-foreground">How to win</h3>
        <p>
          Craft the 🌟 Celestial Relic in Lantern Plaza. It wants a blade, a jewel, a candle, and
          a stew — which means iron country, a long gem, coral, honey, flax, fish, herbs, and
          salt… or someone else&apos;s listings.
        </p>
        {relic ? (
          <div className="flex flex-wrap gap-1">
            {relic.inputs.map((input) => (
              <ItemChip key={input.itemId} itemId={input.itemId} qty={input.qty} />
            ))}
          </div>
        ) : null}
      </section>
      <section className="space-y-2">
        <h3 className="font-heading text-foreground">The catalog</h3>
        <p>
          {items.filter((item) => item.kind === "material").length} gatherable materials,{" "}
          {items.filter((item) => item.kind === "good").length} crafted goods, and 1 relic. Side
          crafts (bread, planks, salve, baskets, bricks, charms) exist so the board has volume
          that is not the relic race.
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="font-heading text-foreground">Ideas worth growing into</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>A second win path: first to 1,000🪙 without the relic, for pure merchants.</li>
          <li>Night-only nodes (owls, moon salt) so log-in time of day matters.</li>
          <li>Player stallfronts — your cosmetics become the shop sign.</li>
          <li>Caravan contracts: lock a travel timer to deliver someone else&apos;s crate.</li>
          <li>Seasonal festival skins that retire when the lanterns change.</li>
        </ul>
      </section>
    </div>
  );
}
