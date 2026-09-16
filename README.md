# TrillionTape — Player Market Game

Trade for a Trillion. A player market of emoji goods at [trilliontape.com](https://trilliontape.com). Post bids and asks, swap bundles, and race to the mark Jesse sets — by default 1,000,000,000,000 of net worth (coin plus goods at market value).

The UI is built for a phone in the pocket and a computer at the desk.

## How to play

1. Create a traveler name and password, or press **Play as Guest** (Guest / play).
2. Your **pack** is the left rail: **Coins** first (how many you have, plus **Vol** for every coin in every purse), then **every** good with **Qty**, **MV**, **Avg** (the average price you paid for units you still hold — board fills at the trade price, other gains at MV), and **Total** (qty × MV). Goods you do not hold still appear at 0. **Net worth** (coin plus goods at MV) sits under the last good, marked with a money bag. Under that is a **coin drop timeline**: each upcoming (and recent) purse, its military-time slot, how much it pays, and a **You are here** mark for the next one.
3. A **tape** at the top of the desk scrolls like a stock ticker: each good’s icon and name, last print size in smaller type when that trade was more than 1 (abbreviated k / M / B), then `@` last price, and if the last print moved versus the oldest of the last 25 prints a green ▲ or red ▼, the coin change, and that change as a percent. Unchanged quotes stay blue and stop after the last price — no arrow, amount, percent, or `--`. Consecutive fills of the same good at the same price between the same two travelers count as one print, so buying 5 wheat at 5 from one seller shows volume 5. Quote text is frozen while it is on the scrolling band so the tape does not snap when the book updates; fresh numbers wait until that loop finishes. After the quotes, **Leaders** and the top ten by net worth keep scrolling — hover to pause, yours is lit in gold if you are on that tape. Tap a quote to select that good; tap **Leaders** (or a name) to open the full leaderboard: coin, each good, and the money bag across the top, with that traveler’s exact counts in the cells below and a total row at the bottom.
4. The **player market** never closes. Trades on the last-tape chip, the item print grid, and Recent trades show the print in **military time** (`HH:MM` on the grid, `HH:MM:SS` on the tape). Treasury fills name the other side **Government**, not the traveler sitting in office. Post a bid or ask at any whole-coin price of 1 or more. A quantity of 3 still posts 3 quotes, but consecutive quotes at the same price from the same traveler stack as `×3` so the book stays short; tap still takes or cancels 1. Crossing bids and asks fill automatically when a bid meets an equal or cheaper ask; if prices tie, the earlier quote trades first. Trades clear at the ask. Tap someone else’s listing to take 1; tap **yours** to cancel 1. **Rarity follows circulating outstanding:** the highest-outstanding quartile is Common, then Uncommon, Rare, and Legendary for the lowest-outstanding quartile, so labels can change as stock is minted or burned. MV is the simple average of the last 25 board trades (catalog starting price if none). **Bid/Ask** is units resting on the book, written `bids/asks` (so `3/4` means 3 on bids and 4 on asks). **Volume** is how many board trades printed today (from local midnight). **Authorized/Issued** (admin only) is the cap on units the treasury may mint, then how many are issued — Issued is kept equal to Authorized. If Outstanding is short of that, the treasury sells the difference at MV until Outstanding first meets Issued; if Outstanding is over, it buys the surplus at MV. After Issued has been met, a government buy raises Treasury (Issued minus Outstanding) instead of selling those units back. Those desk quotes always sit at current MV and re-price whenever MV moves. Treasury quotes do not appear on the traveler tape. A small white **Buy from treasury** button takes 1 at the desk ask; a small black **Sell to treasury** button hits 1 at the desk bid. Each button shows that price and how many sit there (`×3`). Caps are Wheat 150, Berries 135, Wood 120, Fish 105, Flower 90, Stone 75, Mushrooms 60, Coal 45, Shell 30, Gem 15. **Outstanding/Treasury** is units already purchased and sitting in packs, then issued units not yet purchased (Issued minus Outstanding). Outstanding goes **up** when a treasury ask fills, and **down** when a treasury bid fills. Computer traders never mint or burn stock or coin. **Coin volume** is the sum of every purse except the old Banker; it only rises when a treasury bid fills, a new traveler sits down, or admin sets a purse. The old bank’s leftover pack was split evenly by count across Guest and the 22 computers, so those units sit in packs on the desk. Tap a board column (Item, Best bid, Best ask, MV, Bid/Ask, Volume) to sort the list; tap again to reverse. Bid/Ask sorts by bid size for two taps, then by ask size for two more. Missing bids and asks sit at the bottom. Your pack on the left uses the same order (Coins stays on top) and lists every good even at 0. Keyboard: **W** / **S** move up and down the list without jumping the page, **A** fills price with MV (↑/↓ to nudge by the current place), **Shift** moves the arrow step up a place (1 → 10 → 100…), **Ctrl** moves it back down, **D** sets quantity to 1 (↑/↓ to nudge), **V** posts a buy, **X** posts a sell, **Q** takes the best traveler bid, **E** takes the best traveler ask, **T** buys 1 from the treasury, **R** sells 1 to the treasury. The price chart is one-minute candlesticks for the last 20 minutes: each bar’s open is the previous close, and empty minutes sit flat at that close. Volume bars sit under the candles, with dashed MV / best bid / best ask marks on the right.
5. **Direct deals** let two travelers swap several different items plus gold. Those swaps do not print and do not move MV. Each side of a deal shows its total worth at current MV, plus whether you would gain or lose on that mark.
6. Up to one hundred computer traders can sit at the table. Admin sets how many (0–100). Only seated computers get coin drops, opening packs, and a place on the leaders tape. They quote near MV and lift or hit **traveler** bids and asks — they do not take treasury quotes — so they trade with each other and with players. They tick every couple of seconds and post small two-sided quotes (asks of 1–3). After an ask sits about 15 seconds they will pay MV; if it keeps sitting they walk the price up. If a bid sits unfilled they keep bidding up. They do not mint coin. Unfilled quotes stay until they trade. Sitting one out cancels its book and returns its pack to the treasury.
7. **Government** is its own screen (`/government`), not a toggle on the desk. Only traveler **Jesse** can open it. Everyone else is sent back to the desk. Quotes **always sit at MV**. Treasury **asks** do not list on the ask tape; travelers buy them with **Buy from treasury** (**T**), and they mint units into the buyer’s pack when they **fill** (outstanding up) until Outstanding reaches Authorized. Treasury **bids** do not list on the bid tape; travelers sell into them with **Sell to treasury** (**R**), and those bids pay the seller with new coin and burn the goods when they **fill** (outstanding down, coin volume up). Your personal purse is not spent. Back to the desk leaves office; posted quotes stay until they fill or you cancel them.
8. **Admin** is its own office (`/admin`). Only traveler **Jesse** can open it or see the Admin / Government links. Everyone else is sent back to the desk. Pick any traveler (or computer) and set their coins and pack qty, edit Issued for each good, **Add a share type** (name plus an emoji or small image; it starts at Issued 15 / MV 10) or **Delete** one after **Are you sure?** (packs, orders, and tape for that good are wiped; keep at least one), set the **starting purse** (default 1,000), set how many computers sit at the table (0–100), sit other leftover travelers out, **Edit goal** (first to a net-worth or coin mark, first to hold one or more goods, or a clock — 1 minute through 1 month — then most of whatever you picked wins), pick how often the coin drop lands (30 seconds through 1 day), **Edit coin drops** to change each ladder amount (or reset to the default 1k → 2k → 3k… ramp; the last level repeats), and start a **New game**. When the mark or clock hits, the book freezes and a game-over board names the winner. Changing Issued lists leftover on the treasury or buys surplus at MV. New game wipes packs, the book, and the tape, keeps the current computer count, sets every traveler still at the table and each seated computer to 1,000 coins, and deals each good as `floor(Issued ÷ seats)` — seats are travelers at the table plus seated computers. Zero computers does not remove traveler accounts; those leftover names still take a seat. **Sit other travelers out** leaves only you, and their packs go back to the treasury. The remainder of each good stays in the treasury for the government to sell at MV. Someone who opens the desk later sits down with coins and an empty pack. With 1 traveler plus 0 computers, wheat 150 deals 150 to that traveler; with 6 travelers plus 22 computers, wheat 150 deals 5 each and 10 stay in the treasury.

Everyone starts at the admin starting purse (default 1,000 coins), including seated computers. Someone who joins after drops have already landed gets that starting purse plus every drop the table has already been paid, then waits for the next window with everyone else. Coin drops land on a timer (default 5 minutes, set in Admin) for every traveler and seated computer. Admin edits the amounts; the default ladder is 1,000 the first drop, 2,000 the next, 3,000 the next, then 5k, 8k, 15k and on up (not in the same window you join or start a new game). After the last saved level, that purse repeats. A popup shows humans how many coins landed. The pack timeline shows the same clock the tape uses. The default win is **1T net worth**; Admin can change that.

## The catalog

The default table is **10 goods**, in board order: wheat, berries, wood, fish, flower, stone, mushrooms, coal, shell, gem. Opening MV (and the IPO ask) is 10, 20, 30, 40, 50, 60, 70, 80, 90, 100. Issued caps stay 150, 135, 120, 105, 90, 75, 60, 45, 30, 15. Admin can add more share types or delete these. Trade them on the board. There is no crafting — every item stands on its own.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147) on the same machine that is running `npm run dev`. With no extra env, data lives in `data/bazaar.db` (created on first boot). This repo never reads `TURSO_*` or any other project's database variables.

Check **Phone layout** on the gate or the desk to switch to a one-column phone screen (Pack / Book / Orders). The choice sticks in this browser. Phones default to that layout.

To play with friends on one table, leave the server running and share a public URL that points at port `43147`:

```bash
cloudflared tunnel --url http://127.0.0.1:43147
```

Each friend creates their own traveler name on the same landing page. Quick `trycloudflare.com` links last only while that tunnel process is up.

If you are in a Cursor Cloud Agent, **Preview** is a tunnel from your laptop to that remote machine — `127.0.0.1` in your browser is your laptop, not the game. This repo lists port `43147` in `.cursor/environment.json` so new agents can forward it. When that tunnel fails, the agent can open a temporary `trycloudflare.com` URL to the same server.

No extra services or API keys for local play. Accounts sit in the local file; do not reuse a real password.

## Go live on trilliontape.com

GitHub → Fly.io is the right path. Do not put this on the Vercel project you already use. One GitHub repo builds two Fly apps: **`trilliontape-data`** (the book) and **`trilliontape`** (the desk). Cloudflare only points the domain at the desk.

This project does not have a GitHub repository yet. Click **Create repo** in Cursor, choose GitHub, and name it something like `trilliontape`. After that exists, pushes to `main` can deploy.

Two env names, and only these, on the **desk** app:

- `TRILLIONTAPE_DATABASE_URL`
- `TRILLIONTAPE_AUTH_TOKEN`

Cursor preview still uses `data/bazaar.db` until those are set. That file is a different world from production.

### 1. Mint keys that belong only to TrillionTape

From this repo:

```bash
npm run data-host:auth
```

That writes `data-host/keys/` (gitignored): a public key the data host checks, a private key, and a long-lived token. Put the token in `TRILLIONTAPE_AUTH_TOKEN`. Do not reuse it on another app.

### 2. Data host on Fly (`trilliontape-data`)

[Fly.io](https://fly.io) is a small always-on VM with a disk. Log in (`fly auth login`), then:

```bash
cd data-host
fly apps create trilliontape-data
fly volumes create trilliontape_libsql --region iad --size 1 --app trilliontape-data --yes
fly secrets set SQLD_AUTH_JWT_KEY="$(cat keys/jwt.pub.b64url)" --app trilliontape-data
fly deploy --config fly.toml --app trilliontape-data
```

If `trilliontape-data` is taken, change `app` in `data-host/fly.toml` and use that name. Do not attach this volume to another Fly app.

```bash
export TRILLIONTAPE_DATABASE_URL=https://trilliontape-data.fly.dev
export TRILLIONTAPE_AUTH_TOKEN="$(cat data-host/keys/token)"
```

### 3. Desk on Fly from GitHub (`trilliontape`)

After the GitHub repo exists:

```bash
fly apps create trilliontape
fly secrets set TRILLIONTAPE_DATABASE_URL=https://trilliontape-data.fly.dev \
  TRILLIONTAPE_AUTH_TOKEN="$(cat data-host/keys/token)" \
  --app trilliontape
fly deploy --config fly.toml --app trilliontape
```

If `trilliontape` is taken, change `app` in the root `fly.toml`.

**Launch from GitHub** in the Fly dashboard is enough. Leave the working directory blank so it uses the repo-root `fly.toml` (the desk), not `data-host`. Do not paste `fly deploy --image registry.fly.io/trilliontape:deployment-…` — that reuses an old image that listens on the wrong port.

Push-to-deploy is optional. If you want GitHub Actions to deploy too, add repo secret `FLY_API_TOKEN` from `fly tokens create deploy`. Without that secret the Action skips; Launch UI deploys still count.

### If https://trilliontape.fly.dev does not open

Fly can mark a deploy green and still leave the app with **no public IP**. Without an IP, `trilliontape.fly.dev` has no DNS and the browser says the site cannot be reached.

1. Open the desk app: [https://fly.io/apps/trilliontape](https://fly.io/apps/trilliontape) (not `trilliontape-data`).
2. On the **overview** page, find **IP addresses**.
3. Allocate **Shared IPv4** (free). Allocate **IPv6** too if the button is there.
4. Wait about a minute, then open [https://trilliontape.fly.dev](https://trilliontape.fly.dev).

Same thing from a terminal that is already logged into Fly:

```bash
fly ips list -a trilliontape
fly ips allocate-v4 --shared -a trilliontape
fly ips allocate-v6 -a trilliontape
```

You should then see an A or AAAA record for `trilliontape.fly.dev`. The landing page says **TrillionTape** and **Trade for a Trillion**. Cursor preview is a different world; do not create Jesse there if you mean to play on Fly.

### 4. Point trilliontape.com at the desk (Cloudflare)

Wait until https://trilliontape.fly.dev itself works. Then DNS → **CNAME** `@` and `www` to `trilliontape.fly.dev` (or the app name you used), proxy **on**. SSL is automatic.

After DNS is green, open https://trilliontape.com. Create Jesse on that hosted world; the Cursor preview world is a different database and will not follow the domain.

