import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { items } from "@/lib/game/catalog";

const highlights = [
  {
    emoji: "📒",
    title: "A live order book",
    body: "Post a bid or ask at any whole-coin price. Crossing trades clear at the ask. Market value is the average of the last 25 prints.",
  },
  {
    emoji: "🤝",
    title: "Direct deals",
    body: "Bundle several different goods plus gold and send the offer to one traveler, or leave it open for anyone. Those swaps stay off the tape.",
  },
  {
    emoji: "🎒",
    title: "Your pack, priced",
    body: "The left rail shows how many you hold and each item’s current market value. Coin sits at the top. Net worth is at the bottom.",
  },
  {
    emoji: "🤖",
    title: "Plaza regulars",
    body: "Computer traders sit far from MV most of the time, and sometimes take a loss if they think the tape will turn.",
  },
];

const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-background/60 px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:text-sm";
const primaryBtn =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-3 text-base font-medium text-primary-foreground hover:bg-primary/80 md:h-9 md:text-sm";
const secondaryBtn =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-secondary px-3 text-base font-medium text-secondary-foreground hover:bg-secondary/80 md:h-9 md:text-sm";
const outlineBtn =
  "inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-background px-3 text-base font-medium hover:bg-muted md:h-9 md:text-sm";

export function Landing({ error, next }: { error?: string; next?: string }) {
  const nextField = next ? <input type="hidden" name="next" value={next} /> : null;
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
              Night market
            </p>
            <h1 className="font-heading max-w-xl text-4xl leading-tight text-balance sm:text-6xl">
              Trade the tape. Watch the pack.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              A player order book of emoji goods. Buy and sell at any price, swap bundles with
              other travelers, and track coin, market value, and net worth as you go.
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
              <CardTitle>Open a stall on the board</CardTitle>
              <CardDescription>
                Use Guest or create your own traveler. Pack and gold are saved when you leave.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <form action="/auth/guest" method="post" className="space-y-2">
                {nextField}
                <button className={primaryBtn} type="submit">
                  Play as Guest
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Opens the demo book · Guest / play
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
                {nextField}
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
                {nextField}
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
