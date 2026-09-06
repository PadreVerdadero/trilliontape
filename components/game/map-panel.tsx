import { locations, materialsAt, travelSeconds } from "@/lib/game/catalog";
import { formatDuration } from "@/lib/game/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlayerState } from "@/lib/game/types";

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
  onTravel,
  onMine,
}: {
  player: PlayerState;
  pending: boolean;
  onTravel: (locationId: string) => void;
  onMine: (itemId: string) => void;
}) {
  const here = locations.find((location) => location.id === player.locationId);
  const nodes = materialsAt(player.locationId);
  const idle = player.busy.type === "idle";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {locations.map((location) => {
          const current = location.id === player.locationId;
          const walk = travelSeconds(player.locationId, location.id);
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
              <CardContent>
                {current ? (
                  <p className="text-xs text-muted-foreground">{location.region}</p>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!idle || pending}
                    onClick={() => onTravel(location.id)}
                  >
                    Walk · {formatDuration(walk * 1000)}
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
            <CardTitle>Gather at {here.name}</CardTitle>
            <CardDescription>
              Each action starts a timer. You cannot walk or gather again until it finishes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {nodes.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-background/40 p-3 ring-1 ring-foreground/10"
              >
                <div>
                  <p className="font-medium">
                    {item.emoji} {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.mine!.seconds}s · {item.mine!.yieldMin}
                    {item.mine!.yieldMax !== item.mine!.yieldMin
                      ? `–${item.mine!.yieldMax}`
                      : ""}{" "}
                    each pull
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={!idle || pending}
                  onClick={() => onMine(item.id)}
                >
                  Gather
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {here?.id === "town" ? (
        <Card>
          <CardHeader>
            <CardTitle>Plaza work</CardTitle>
            <CardDescription>
              Use the tabs for the public board, workshop, bank window, and wardrobe. The relic is
              crafted here from a blade, jewel, candle, and stew.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
