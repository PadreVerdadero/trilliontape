import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { items } from "@/lib/game/catalog";

const highlights = [
  {
    emoji: "🗺️",
    title: "The road takes time",
    body: "Walk between five places on the map. Start a trip, log out, and you will be there when you return.",
  },
  {
    emoji: "⛏️",
    title: "Search the wilds",
    body: "You search a whole area and pull a random find. If too many travelers comb the same place, searches slow down until it goes quiet.",
  },
  {
    emoji: "📒",
    title: "A real order book",
    body: "Post a bid or an ask at your price. Click an order to take it. If a bid sits above an ask, they match at the lower price.",
  },
  {
    emoji: "🏦",
    title: "The bank window",
    body: "Always dump stock at the market average — the volume-weighted price of every trade in that emoji.",
  },
];

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-background/60 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const primaryBtn =
  "inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80";
const secondaryBtn =
  "inline-flex h-9 w-full items-center justify-center rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80";
const outlineBtn =
  "inline-flex h-9 w-full items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted";

export function Landing({ error }: { error?: string }) {
  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(232,176,80,0.18),_transparent_42%),radial-gradient(circle_at_80%_20%,_rgba(255,120,70,0.12),_transparent_30%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 md:py-16">
        <header className="flex items-center justify-between gap-4">
          <p className="font-heading text-lg tracking-wide">🏮 Lantern Bazaar</p>
          <p className="hidden text-sm text-muted-foreground sm:block">
            A player market you can walk away from
          </p>
        </header>

        <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
              Harvest of Lanterns
            </p>
            <h1 className="font-heading max-w-xl text-4xl leading-tight text-balance sm:text-6xl">
              Gather the emojis. Set the prices. Light the relic.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              You are a traveling crafter in a night market that never sleeps. Materials live in
              the woods, ridge, shore, and fields. Crafted goods and the winning{" "}
              <span className="text-foreground">🌟 Celestial Relic</span> are made in town. Other
              players post buy and sell orders like a tiny stock exchange — or you sell straight
              to the bank at the going average.
            </p>
            <div className="flex flex-wrap gap-2">
              {items
                .filter((item) => item.kind === "material")
                .map((item) => (
                  <span
                    key={item.id}
                    title={item.name}
                    className="grid size-9 place-items-center rounded-full bg-card text-lg ring-1 ring-foreground/10"
                  >
                    {item.emoji}
                  </span>
                ))}
            </div>
          </div>

          <Card className="overflow-visible bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>Return to the plaza</CardTitle>
              <CardDescription>
                Use the Guest stall or create your own. Pack, gold, and timers are saved when you
                leave.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <form action="/auth/guest" method="post" className="space-y-2">
                <button className={primaryBtn} type="submit">
                  Play as Guest
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Opens the demo stall · Guest / play
                </p>
              </form>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/80" />
                </div>
                <p className="relative mx-auto w-fit bg-card px-2 text-xs text-muted-foreground">
                  or sign in
                </p>
              </div>

              <form action="/auth/login" method="post" className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="login-username">
                    Traveler name
                  </label>
                  <input
                    id="login-username"
                    name="username"
                    autoComplete="username"
                    defaultValue="Guest"
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="login-password">
                    Password
                  </label>
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    defaultValue="play"
                    className={fieldClass}
                  />
                </div>
                <button className={secondaryBtn} type="submit">
                  Enter the bazaar
                </button>
              </form>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/80" />
                </div>
                <p className="relative mx-auto w-fit bg-card px-2 text-xs text-muted-foreground">
                  new traveler
                </p>
              </div>

              <form action="/auth/register" method="post" className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="register-username">
                    New name
                  </label>
                  <input
                    id="register-username"
                    name="username"
                    autoComplete="username"
                    placeholder="e.g. EmberWalker"
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="register-password">
                    New password
                  </label>
                  <input
                    id="register-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    className={fieldClass}
                  />
                </div>
                <button className={outlineBtn} type="submit">
                  Create traveler
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {highlights.map((item) => (
            <Card key={item.title} className="bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>{item.emoji}</span>
                  {item.title}
                </CardTitle>
                <CardDescription className="text-sm leading-6">{item.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
