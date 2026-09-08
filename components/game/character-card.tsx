import { defaultBodyEmoji, locationById } from "@/lib/game/catalog";
import { formatCoins, formatNumber } from "@/lib/game/format";
import type { PlayerState } from "@/lib/game/types";

export function CharacterCard({ player }: { player: PlayerState }) {
  const location = locationById[player.locationId];

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="grid size-36 place-items-center rounded-3xl bg-gradient-to-b from-amber-200/15 to-transparent text-5xl ring-1 ring-foreground/10">
        {defaultBodyEmoji()}
      </div>
      <div>
        <p className="font-heading text-xl">{player.username}</p>
        <p className="text-sm text-muted-foreground">
          {formatNumber(player.vp ?? 0)} VP
          {player.titles?.length ? ` · ${player.titles.join(" · ")}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {location?.searchEnergy
            ? `${location.emoji} ${location.name} forage lean`
            : `${location?.emoji ?? "🏮"} Plaza grounds`}
        </p>
      </div>
      <div className="w-full space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Energy</span>
          <span className="text-foreground">
            {player.energy} / {player.energyMax}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-background/70 ring-1 ring-foreground/10">
          <div
            className="h-full bg-emerald-400/80 transition-all"
            style={{
              width: `${Math.max(0, Math.min(100, (player.energy / Math.max(1, player.energyMax)) * 100))}%`,
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        <span className="rounded-full bg-primary/15 px-3 py-1 font-medium text-primary">
          {formatCoins(player.availableGold)}
          {player.availableGold !== player.gold ? (
            <span className="ml-1 text-muted-foreground">
              / {formatCoins(player.gold)}
            </span>
          ) : null}
        </span>
        {player.hasWon ? (
          <span className="rounded-full bg-amber-400/20 px-3 py-1 text-amber-100">
            🌟 Lantern lit
          </span>
        ) : null}
      </div>
      {player.availableGold !== player.gold ? (
        <p className="text-xs text-muted-foreground">
          Coin on open bids and deals is reserved until those fill or cancel.
        </p>
      ) : null}
      {player.buffs?.length ? (
        <ul className="w-full space-y-1 text-left text-xs text-muted-foreground">
          {player.buffs.map((buff) => (
            <li
              key={buff.kind}
              className="rounded-lg bg-primary/10 px-2 py-1 text-foreground/90"
            >
              {buff.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
