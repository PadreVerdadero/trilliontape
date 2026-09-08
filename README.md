# Lantern Bazaar

A player market of emoji goods. Post bids and asks, swap bundles with other travelers, and watch coin, market value, and net worth.

The UI is built for a phone in the pocket and a computer at the desk.

## How to play

1. Create a traveler name and password, or press **Play as Guest** (Guest / play).
2. Your **pack** is the left rail: **Coins** first (how many you have), then each good with **Qty**, **MV**, and **Total** (qty × MV).
3. **Net worth** (coin plus goods at MV) sits at the bottom.
4. The **player market** never closes. Post a bid or ask at any whole-coin price of 1 or more. Crossing trades clear at the ask. Tap someone else’s listing to take it; tap **your highlighted bid or ask** to cancel it. MV is the simple average of the last 100 board trades (catalog starting price if none). **Bid/Ask** is units resting on the book, written `bids/asks` (so `3/4` means 3 on bids and 4 on asks). **Volume** is how many exist in packs and could be traded — it goes **up** when new stock is minted (a filled treasury ask, or plaza regulars restocking) and **down** when stock is burned (a filled treasury bid). The price chart marks the current best bid and best ask as dashed lines on the right so you can see the gap.
5. **Direct deals** let two travelers swap several different items plus gold. Those swaps do not print and do not move MV.
6. Twenty-two plaza regulars (computer traders) keep the book lively. Many will bid well above MV or ask well below it, even when that is a bad deal for them — those prints can still move the price.
7. **Play as government** (practice) uses an **unlimited treasury** that does not change your personal coins. A filled treasury **ask** mints units into the buyer’s pack (the buyer’s coins are burned). A filled treasury **bid** pays the seller with new coin and destroys the goods.
8. **Admin** lets you set your coin balance and the quantity of the selected pack item. Use this to correct a purse after testing.

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
