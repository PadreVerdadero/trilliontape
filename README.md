# Lantern Bazaar

A player market of emoji goods. Post bids and asks, swap bundles with other travelers, and watch coin, market value, and net worth.

The UI is built for a phone in the pocket and a computer at the desk.

## How to play

1. Create a traveler name and password, or press **Play as Guest** (Guest / play).
2. Your **pack** is the left rail: **Coins** first (how many you have, plus **Vol** for every coin in every purse), then **every** good with **Qty**, **MV**, **Avg** (the average price you paid for units you still hold — board fills at the trade price, other gains at MV), and **Total** (qty × MV). Goods you do not hold still appear at 0.
3. **Net worth** (coin plus goods at MV) sits at the bottom. A **leaders** tape at the top of the desk scrolls the top ten by net worth — hover to pause, yours is lit in gold if you are on that tape. Tap the tape to open the full leaderboard.
4. The **player market** never closes. Post a bid or ask at any whole-coin price of 1 or more. A quantity of 3 still posts 3 quotes, each listed on its own line so you can take or cancel as many as you want. Crossing bids and asks fill automatically when a bid meets an equal or cheaper ask; if prices tie, the earlier quote trades first. Trades clear at the ask. Tap someone else’s listing to take 1; tap **yours** to cancel 1. **Rarity follows circulating volume:** the highest-volume quartile is Common, then Uncommon, Rare, and Legendary for the lowest-volume quartile, so labels can change as stock is minted or burned. MV is the simple average of the last 25 board trades (catalog starting price if none). **Bid/Ask** is units resting on the book, written `bids/asks` (so `3/4` means 3 on bids and 4 on asks). **Volume** is how many exist in packs — it goes **up** when a treasury ask fills, and **down** when a treasury bid fills. Computer traders never mint or burn stock. The old bank’s leftover pack was split evenly by count across Guest and the 22 computers, so those units sit in packs on the desk. Tap a board column (Item, Best bid, Best ask, MV, Bid/Ask, Volume) to sort the list; tap again to reverse. Bid/Ask sorts by bid size for two taps, then by ask size for two more. Missing bids and asks sit at the bottom. Your pack on the left uses the same order (Coins stays on top) and lists every good even at 0. Keyboard: **W** / **S** move up and down the list without jumping the page, **A** fills price with MV (↑/↓ to nudge by the current place), **Shift** moves the arrow step up a place (1 → 10 → 100…), **Ctrl** moves it back down, **D** sets quantity to 1 (↑/↓ to nudge), **V** posts a buy, **X** posts a sell, **Q** takes the best bid, **E** takes the best ask. The price chart marks the current best bid and best ask as dashed lines on the right so you can see the gap.
5. **Direct deals** let two travelers swap several different items plus gold. Those swaps do not print and do not move MV. Each side of a deal shows its total worth at current MV, plus whether you would gain or lose on that mark.
6. Twenty-two computer traders keep the book lively. Most of their resting quotes sit well away from MV. Now and then one will take a loss — lift an ask above MV or hit a bid below it — hoping the next prints pull the price their way. On cheap goods they will eat a few extra coins of loss (a 7-coin berry when MV is 4) more often than they would on a high-priced gem. If a bid sits unfilled, they keep bidding up with no cap — the longer it waits, the more they will pay, until it fills. If an ask sits unfilled, they keep cutting with no cap — the longer it waits, the less they will take, down to 1 coin, until it fills. Unfilled quotes stay until they trade.
7. **Play as government** (practice) uses an **unlimited treasury** that does not change your personal coins. Treasury **asks** are white on the book and mint units into the buyer’s pack when they **fill** (volume up). Treasury **bids** are black with white text and pay the seller with new coin while destroying the goods when they **fill** (volume down). Posting a quote does not change volume. Leaving office leaves those quotes on the board until they fill or you cancel them.
8. **Admin** lets you set your coin balance and the quantity of the selected pack item. Use this to correct a purse after testing.

You start with a little gold, wheat, wood, and berries.

## The catalog

**11 goods**. Trade them on the board. There is no crafting — every item stands on its own.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147). Data lives in `data/bazaar.db` (created on first boot).

No extra services or API keys. Accounts are stored on this machine; do not reuse a real password.
