# Lantern Bazaar

A traveler’s market of emoji goods. Forage the grounds, flip stock on a player order book, and sell to **shop owners who keep real hours**. First to **20 victory points** lights the festival. The **🌟 Celestial Relic** is an 8-point contract, not the only win.

The UI is built for a phone in the pocket and a computer at the desk.

## How to play

1. Create a traveler name and password, or press **Play as Guest** (Guest / play).
2. **Forage** the grounds. Each pull costs energy and happens instantly. Eat berries, bread, fish, honey, or stew to refill. Crowds on the grounds raise the next cost until the area sits quiet for 45 seconds.
3. Optional: scan a QR at a real stop (or open `/codes`) so the next forage leans woods, ridge, shore, or fields.
4. On **Stalls**, sell to whoever is open. Hours follow your phone’s clock. The chalkboard item pays more. Sunday 10am–2pm opens everyone.
5. The **player market** never closes. Post a bid or ask. Crossing trades clear at the ask.
6. The **bank** always buys at **50% of MV** — the dump window when stalls are shut.
7. Score VP from contracts, chalkboard hours, first daily board trade, wardrobe slots, lantern donations, and the relic.

You start with a little gold, wheat, wood, flax, and berries.

## Stalls

| Owner | Hours (your local clock) | Buys | Sells |
| --- | --- | --- | --- |
| 🍞 Mira the baker | Mornings 7–10, weekends until noon | Wheat, honey | Bread |
| ⚒️ Old Ket the smith | Weekdays 1–5pm | Iron, coal, stone | Bricks |
| 🐟 Tide Han | Dawn 5–8, Saturday until noon | Fish, salt, shells, coral | — |
| 🌿 Nim the herbalist | Mon / Wed / Fri 5–9pm | Herbs, mushrooms, berries | Salve |
| 🌸 Lark the florist | Evenings 6–11pm | Flowers, flax | Charms |
| 🌙 Night broker | Friday 6–9pm | Gems, coral, blades, jewels | — |

Sunday market (10am–2pm) opens every stall. Pay 15🪙 for tomorrow’s chalkboard rumor. Rent a 25🪙 crate to bump your payout 10% for that window.

## Victory

First to **20 VP** (or the relic) lights the lantern. Titles:

- **Champion** — most VP
- **Purse** — most coin from stalls plus donations
- **Baker’s friend** — most food delivered
- **Night broker** — most legendary turn-ins
- **Board ghost** — most player-board fills

Lantern donations convert gold to VP with a doubling cost (50, then 100, then 200…).

## The catalog

**16 materials**, **10 crafted goods**, **1 relic**, and **12 cosmetics**. Every item has one job — eat it, use it, craft it, or sell it to a stall that wants it.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147). Data lives in `data/bazaar.db` (created on first boot).

No extra services or API keys. Accounts are stored on this machine; do not reuse a real password.
