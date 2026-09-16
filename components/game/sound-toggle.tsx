"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  deskSoundsMuted,
  playDeskSound,
  setDeskSoundsMuted,
  subscribeDeskSoundPref,
} from "@/lib/game/sounds";
import { cn } from "@/lib/utils";

export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(true);
  const heard = useRef(false);

  useEffect(() => {
    const sync = () => setOn(!deskSoundsMuted());
    sync();
    return subscribeDeskSoundPref(sync);
  }, []);

  async function onClick() {
    if (!on) {
      setDeskSoundsMuted(false);
      setOn(true);
      heard.current = true;
      await playDeskSound("buy");
      return;
    }
    if (!heard.current) {
      heard.current = true;
      await playDeskSound("buy");
      return;
    }
    setDeskSoundsMuted(true);
    setOn(false);
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      title={
        !on
          ? "Sound is off. Tap to hear a test chime."
          : heard.current
            ? "Sound is on. Tap to mute."
            : "Tap to hear a test chime."
      }
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      {on ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      <span className="hidden sm:inline">Sound</span>
    </button>
  );
}
