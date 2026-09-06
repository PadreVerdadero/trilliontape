import { locations, materialsAt } from "@/lib/game/catalog";
import { formatDuration } from "@/lib/game/format";
import { rarityClass, rarityLabel, rarityOf, rarityText } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AreaCrowd, PlayerState } from "@/lib/game/types";

const layout: Record<string, string> = {
  ridge: "md:col-start-2",
  woods: "md:col-start-1 md:row-start-2",
  town: "md:col-start-2 md:row-start-2",
  fields: "md:col-start-3 md:row-start-2",
  shore: "md:col-start-2 md:row-start-3",
};

export function MapPanel({
  player,
  pending,
  areas,
  onArrive,
  onSearch,
}: {
  player: PlayerState;
  pending: boolean;
  areas: AreaCrowd[];
  onArrive: (locationId: string) => void;
  onSearch: () => void;
}) {
  const here = locations.find((location) => location.id === player.locationId);
  const nodes = materialsAt(player.locationId);
  const crowd = areas.find((area) => area.locationId === player.locationId);
  const idle = player.busy.type === "idle";

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        In real life, scan the QR at the stop. On this computer, tap{" "}
        <span className="text-foreground">I&apos;m here</span> to check in the same way.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {locations.map((location) => {
          const current = location.id === player.locationId;
          const area = areas.find((entry) => entry.locationId === location.id);
          const crowded = (area?.strain ?? 0) > 0 || (area?.searchers ?? 0) > 0;
          return (
            <Card
              key={location.id}
              className={`${layout[location.id] ?? ""} ${
                current ? "ring-2 ring-primary" : ""
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>
                    {location.emoji} {location.name}
                  </span>
                  {current ? (
                    <span className="text-xs font-normal text-primary">You are here</span>
                  ) : null}
                </CardTitle>
                <CardDescription>{location.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {crowded ? (
                  <p className="text-xs text-amber-100/90">
                    Crowded · next search {area?.nextSearchSeconds}s
                    {area && area.cooldownMs > 0
                      ? ` · quiet in ${formatDuration(area.cooldownMs)}`
                      : ""}
                  </p>
                ) : location.searchSeconds ? (
                  <p className="text-xs text-muted-foreground">
                    Search {location.searchSeconds}s · random find
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{location.region}</p>
                )}
                {current ? null : (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-11 w-full md:h-8 md:w-auto"
                    disabled={!idle || pending}
                    onClick={() => onArrive(location.id)}
                  >
                    I&apos;m here
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {here && nodes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Search {here.name}</CardTitle>
            <CardDescription>
              One pull, random loot from this biome. Commons show up more often. If other
              travelers are pulling here too, the timer stretches until the area goes quiet
              for 45s.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {nodes.map((item) => (
                <span
                  key={item.id}
                  title={rarityLabel[rarityOf(item.id)]}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full bg-background/50 px-2 py-1 text-xs ring-1",
                    rarityClass(item.id)
                  )}
                >
                  <span className="text-sm">{item.emoji}</span>
                  {item.name}
                  <span className={cn("text-[10px]", rarityText[rarityOf(item.id)])}>
                    {rarityLabel[rarityOf(item.id)]}
                  </span>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {crowd && crowd.strain > 0
                  ? `Strain ${crowd.strain} · this search ${crowd.nextSearchSeconds}s · cools in ${formatDuration(crowd.cooldownMs)}`
                  : `Quiet · this search ${crowd?.nextSearchSeconds ?? here.searchSeconds}s`}
              </p>
              <Button
                size="lg"
                className="h-11 w-full sm:w-auto md:h-8"
                disabled={!idle || pending}
                onClick={onSearch}
              >
                Search
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {here?.id === "town" ? (
        <Card>
          <CardHeader>
            <CardTitle>Plaza work</CardTitle>
            <CardDescription>
              Use Board, Craft, Bank, and Wardrobe below. The relic is crafted here from a blade,
              jewel, candle, and stew.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
