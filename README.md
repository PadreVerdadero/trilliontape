# Lantern Bazaar

A traveler’s market of emoji goods. You walk between biomes, gather on real timers, post your own buy and sell prices, and craft the **🌟 Celestial Relic** to win. Close the tab mid-walk or mid-mine — the clock keeps running, and your pack is still there when you sign back in.

## How to play

1. Create a traveler name and password.
2. Walk from **Lantern Plaza** to the woods, ridge, shore, or fields. Travel takes time.
3. **Search** a biome for a random material. Commons show up more often. If several people search the same place, each pull takes longer until that area sits quiet for 45 seconds.
4. Return to the plaza to craft, sell to the bank, or buy cosmetics.
5. On the public board, post a **bid** or **ask**. Click someone else’s order to take it. If a bid sits above an ask, they match at the **lower (ask) price**.
6. The bank always buys at the **average trade price** for that emoji.
7. Win by crafting the relic: 🗡️ blade + 💍 jewel + 🕯️ candle + 🍲 stew.

You start with a little gold, wheat, wood, and flax so the first bread or basket is possible without a full circuit.

## The catalog

**16 materials** across four gathering places, **10 crafted goods**, **1 relic**, and **12 cosmetics**.

| Place | Gather |
| --- | --- |
| 🌲 Whispering Woods | 🪵 wood, 🍓 berries, 🌿 herbs, 🍄 mushrooms |
| ⛰️ Ironridge | 🪨 stone, ⛓️ iron, 🔥 coal, 💎 gem |
| 🏖️ Sunshore | 🐟 fish, 🐚 shell, 🧂 salt, 🪸 coral |
| 🌾 Golden Fields | 🌾 wheat, 🧵 flax, 🍯 honey, 🌸 flower |

Side crafts (bread, planks, salve, baskets, bricks, charms) exist so the board has volume that is not only the relic race.

## Run locally

```bash
npm install
npm run dev -- --port 43147
```

Open [http://localhost:43147](http://localhost:43147). Data lives in `data/bazaar.db` (created on first boot). The plaza **Banker** seeds a few starter listings so a solo traveler can still trade.

No extra services or API keys. Accounts are stored on this machine; do not reuse a real password.
