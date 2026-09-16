"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  deskSoundsMuted,
  deskSoundsUnlocked,
  playDeskSound,
  setDeskSoundsMuted,
  subscribeDeskSoundPref,
  unlockDeskSounds,
} from "@/lib/game/sounds";
import { cn } from "@/lib/utils";

export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(true);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const sync = () => {
      setOn(!deskSoundsMuted());
      setArmed(deskSoundsUnlocked());
    };
    sync();
    return subscribeDeskSoundPref(sync);
  }, []);

  async function onClick() {
    if (!on) {
      setDeskSoundsMuted(false);
      setOn(true);
      setArmed(true);
      await playDeskSound("buy");
      return;
    }
    if (!armed) {
      setArmed(true);
      await unlockDeskSounds();
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
          : armed
            ? "Sound is on. Tap to mute."
            : "Tap to turn desk sounds on."
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
