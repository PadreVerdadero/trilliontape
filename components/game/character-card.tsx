import { cosmeticById, defaultBodyEmoji, locationById } from "@/lib/game/catalog";
import { formatCoins } from "@/lib/game/format";
import type { PlayerState } from "@/lib/game/types";

export function CharacterCard({ player }: { player: PlayerState }) {
  const hat = player.equipped.hat ? cosmeticById[player.equipped.hat] : null;
  const outfit = player.equipped.outfit ? cosmeticById[player.equipped.outfit] : null;
  const accessory = player.equipped.accessory
    ? cosmeticById[player.equipped.accessory]
    : null;
  const location = locationById[player.locationId];

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative grid size-36 place-items-center rounded-3xl bg-gradient-to-b from-amber-200/15 to-transparent ring-1 ring-foreground/10">
        <div className="absolute top-3 text-3xl">{hat?.emoji ?? " "}</div>
        <div className="flex items-end gap-1 text-4xl leading-none">
          <span>{accessory?.emoji ?? ""}</span>
          <span>{outfit?.emoji ?? defaultBodyEmoji()}</span>
        </div>
      </div>
      <div>
        <p className="font-heading text-xl">{player.username}</p>
        <p className="text-sm text-muted-foreground">
          {location?.emoji} {location?.name}
        </p>
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
            🌟 Festival champion
          </span>
        ) : null}
      </div>
      {player.availableGold !== player.gold ? (
        <p className="text-xs text-muted-foreground">
          Coin on open bids is reserved until those orders fill or cancel.
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
