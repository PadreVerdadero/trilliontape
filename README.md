# Lantern Bazaar

A traveler’s market of emoji goods. Check in at real-world stops (or tap **I'm here** at a desk), search biomes for energy, post your own buy and sell prices, and craft the **🌟 Celestial Relic** to win. Eat food to refill. Your pack is still there when you sign back in.

The UI is built for a phone in the pocket and a computer at the desk. Arrival is a **check-in**, not a travel timer.

## How to play

1. Create a traveler name and password, or press **Play as Guest** (Guest / play).
2. Arrive at a place by scanning that stop’s QR, or by tapping **I'm here** on the map while you test on a computer.
3. **Search** a biome for a random material. Each pull costs energy and happens instantly. Commons show up more often. If several people search the same place, the next pull costs more until that area sits quiet for 45 seconds. Eat berries, bread, fish, or honey to refill.
4. Check in at the plaza to craft, sell to the bank, or buy cosmetics.
5. On the public board, post a **bid** or **ask**. Click someone else’s order to take it. If a bid sits above an ask, they match at the **lower (ask) price**.
6. The **bank never posts bids or asks**. It only buys at **50% of MV**. Each unit they take of that emoji drops the cut; after 60s quiet it returns to 50%.
7. Win by crafting the relic: 🗡️ blade + 💍 jewel + 🕯️ candle + 🍲 stew.

You start with a little gold, wheat, wood, and flax so the first bread or basket is possible without a full circuit.

## Test arrivals on a computer

You do not need printed codes to play. On the map, tap **I'm here** next to a place. That is the same check-in a QR scan uses.

Open `/codes` (or **Codes** in the header) to see the five QR images and an **Open to test** link under each one.

## Real-life QR codes

1. Sign in, open `/codes`.
2. If phones will not be on this same machine, paste a reachable URL (LAN IP or hosted origin) into **URL printed on the codes**.
3. Print the page (or screenshot the five squares) and stick each code at the matching real-world spot.
4. A signed-in player scans the code. Their phone opens `/here/woods` (or ridge, shore, fields, town) and they arrive there instantly.
5. If they are not signed in, they land on the gate with a return path, then bounce to the check-in after they sign in.

Use the phone’s camera. No extra app. Codes printed from `127.0.0.1` only work on that computer.

## The catalog

**16 materials** across four gathering places, **10 crafted goods**, **1 relic**, and **12 cosmetics**.

| Place | Gather |
| --- | --- |
| 🌲 Whispering Woods | 🪵 wood, 🍓 berries, 🌿 herbs, 🍄 mushrooms |
| ⛰️ Ironridge | 🪨 stone, ⛓️ iron, 🔥 coal, 💎 gem |
| 🏖️ Sunshore | 🐟 fish, 🐚 shell, 🧂 salt, 🪸 coral |
| 🌾 Golden Fields | 🌾 wheat, 🧵 flax, 🍯 honey, 🌸 flower |

Every item has one job:

| Item | Purpose |
| --- | --- |
| 🪵 Wood | Craft planks or a basket |
| 🍓 Berries | Eat +4 energy |
| 🌿 Herbs | Craft salve or stew |
| 🍄 Mushrooms | Eat: next search finds two things (also salve) |
| 🪨 Stone | Craft a brick |
| ⛓️ Iron | Craft a blade |
| 🔥 Coal | Fire a blade or a brick |
| 💎 Gem | Craft a jewel |
| 🐟 Fish | Eat +6 energy, or stew |
| 🐚 Shell | Next search skips Commons (also charm) |
| 🧂 Salt | Craft stew |
| 🪸 Coral | Craft a jewel |
| 🌾 Wheat | Craft bread |
| 🧵 Flax | Craft a basket or a candle |
| 🍯 Honey | Eat +8 energy, or a candle |
| 🌸 Flower | Next search leans Rare+ (also charm) |
| 🍞 Bread | Eat +10 energy |
| 🪜 Planks | Next 2 searches ignore crowd cost |
| 🩹 Salve | +8 energy and next search ignores crowd |
| 🧺 Basket | Next find +1 |
| 🧱 Brick | Next search costs 1 energy |
| 📿 Charm | Strong luck (Unique / Legendary) |
| 🕯️ Candle / 🗡️ Blade / 💍 Jewel | Relic pieces |
| 🍲 Stew | Eat: refill 20 energy, **or** relic piece |
| 🌟 Celestial Relic | Craft to win |

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147). Data lives in `data/bazaar.db` (created on first boot).

No extra services or API keys. Accounts are stored on this machine; do not reuse a real password.
