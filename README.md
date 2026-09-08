# Lantern Bazaar

A player market of emoji goods. Post bids and asks, swap bundles with other travelers, and watch coin, market value, and net worth.

The UI is built for a phone in the pocket and a computer at the desk.

## How to play

1. Create a traveler name and password, or press **Play as Guest** (Guest / play).
2. Your **pack** is the left rail: how many you hold, and each item’s current **market value**.
3. **Coin** sits at the top. **Net worth** (coin plus goods at MV) sits at the bottom.
4. The **player market** never closes. Post a bid or ask at any whole-coin price of 1 or more. Crossing trades clear at the ask. MV is the simple average of the last 100 board trades (catalog starting price if none). **Listed** is how many units are for sale.
5. **Direct deals** let two travelers swap several different items plus gold. Those swaps do not print and do not move MV.
6. Twelve plaza regulars (computer traders) keep the book lively.

You start with a little gold, wheat, wood, flax, and berries.

## The catalog

**16 materials**, **10 crafted goods**, and **1 relic**. Trade them on the board.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147). Data lives in `data/bazaar.db` (created on first boot).

No extra services or API keys. Accounts are stored on this machine; do not reuse a real password.
