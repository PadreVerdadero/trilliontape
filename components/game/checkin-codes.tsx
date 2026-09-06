"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { locations } from "@/lib/game/catalog";
import { herePath } from "@/lib/game/places";

function originFrom(raw: string, fallback: string) {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fallback;
    return parsed.origin;
  } catch {
    return fallback;
  }
}

function subscribe() {
  return () => {};
}

function browserOrigin() {
  return window.location.origin;
}

export function CheckinCodes() {
  const liveOrigin = useSyncExternalStore(subscribe, browserOrigin, () => "");
  const [publicUrl, setPublicUrl] = useState("");
  const [images, setImages] = useState<Record<string, string>>({});
  const origin = useMemo(
    () => originFrom(publicUrl || liveOrigin, liveOrigin),
    [publicUrl, liveOrigin]
  );

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    void Promise.all(
      locations.map(async (location) => {
        const url = `${origin}${herePath(location.id)}`;
        const src = await QRCode.toDataURL(url, {
          width: 280,
          margin: 1,
          color: { dark: "#1f1408", light: "#f4e6c4" },
        });
        return [location.id, src] as const;
      })
    ).then((entries) => {
      if (!cancelled) setImages(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [origin]);

  return (
    <div className="space-y-6">
      <div className="max-w-xl space-y-2 print:hidden">
        <Label htmlFor="public-url">URL printed on the codes</Label>
        <Input
          id="public-url"
          value={publicUrl || liveOrigin}
          inputMode="url"
          autoComplete="url"
          placeholder="https://your-lantern.example"
          onChange={(event) => setPublicUrl(event.target.value)}
        />
        <p className="text-xs leading-5 text-muted-foreground">
          Codes use this origin. Leave it as this computer to test here. Before you print for
          a real walk, paste the address phones can actually open (a LAN IP or a hosted URL).
          <code className="ml-1 text-foreground">127.0.0.1</code> only works on this machine.
        </p>
        <button
          type="button"
          className="text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => window.print()}
        >
          Print this page
        </button>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => {
          const url = origin ? `${origin}${herePath(location.id)}` : herePath(location.id);
          return (
            <article
              key={location.id}
              className="break-inside-avoid rounded-2xl bg-card p-4 text-center ring-1 ring-foreground/10"
            >
              <p className="font-heading text-lg">
                {location.emoji} {location.name}
              </p>
              <p className="mb-3 text-xs text-muted-foreground">{location.region}</p>
              {images[location.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={images[location.id]}
                  alt={`Check-in code for ${location.name}`}
                  className="mx-auto h-48 w-48 rounded-xl"
                />
              ) : (
                <div className="mx-auto grid h-48 w-48 place-items-center text-sm text-muted-foreground">
                  Drawing the code…
                </div>
              )}
              <p className="mt-3 break-all text-[11px] text-muted-foreground">{url}</p>
              <a
                href={herePath(location.id)}
                className="mt-3 inline-flex h-11 items-center justify-center rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground print:hidden"
              >
                Open to test
              </a>
            </article>
          );
        })}
      </div>
    </div>
  );
}
