"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItemIcon } from "@/components/game/item-icon";
import { MAX_SHARE_IMAGE_CHARS, MAX_SHARE_TYPES, validateShareDraft } from "@/lib/game/shares";

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 120_000) {
      reject(new Error("Keep the image under 120 KB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

export function ShareEditor({
  pending,
  count,
  onAdd,
}: {
  pending: boolean;
  count: number;
  onAdd: (draft: { name: string; emoji?: string; image?: string | null }) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setEmoji("");
    setImage(null);
    setError(null);
  }

  return (
    <>
      <Button
        variant="outline"
        disabled={pending || count >= MAX_SHARE_TYPES}
        className="border-amber-400/50 bg-transparent text-amber-50 hover:bg-amber-900"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Add a share type
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-md border border-amber-400/30 bg-amber-950 text-amber-50"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle className="text-amber-100">New share type</DialogTitle>
            <DialogDescription className="text-amber-100/70">
              Name it and give it an emoji or a small image. It starts at Issued 15 and MV 10. You
              can change Issued in the table after it lands.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="share-name" className="text-amber-100/80">
                Name
              </Label>
              <Input
                id="share-name"
                value={name}
                maxLength={24}
                onChange={(event) => setName(event.target.value)}
                className="border-amber-400/30 bg-amber-950/60"
                placeholder="Tea"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="share-emoji" className="text-amber-100/80">
                Emoji
              </Label>
              <Input
                id="share-emoji"
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                className="border-amber-400/30 bg-amber-950/60"
                placeholder="🍵"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="share-image" className="text-amber-100/80">
                Image (optional)
              </Label>
              <Input
                id="share-image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="border-amber-400/30 bg-amber-950/60 text-amber-50 file:text-amber-950"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    setImage(null);
                    return;
                  }
                  void readImageFile(file)
                    .then((data) => {
                      if (data.length > MAX_SHARE_IMAGE_CHARS) {
                        setError("That image is too large. Use a smaller file.");
                        setImage(null);
                        return;
                      }
                      setImage(data);
                      setError(null);
                    })
                    .catch((err: unknown) => {
                      setImage(null);
                      setError(err instanceof Error ? err.message : "Could not read that image.");
                    });
                }}
              />
            </div>
            <p className="flex items-center gap-2 text-sm text-amber-100/80">
              Preview <ItemIcon item={{ emoji, name, image }} className="text-xl" /> {name || "…"}
            </p>
            {error ? <p className="text-sm text-red-200">{error}</p> : null}
          </div>
          <DialogFooter className="border-amber-400/20 bg-amber-900/40">
            <Button
              variant="outline"
              className="border-amber-400/40 bg-transparent text-amber-50"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={pending}
              className="bg-amber-300 text-amber-950 hover:bg-amber-200"
              onClick={() => {
                try {
                  const draft = validateShareDraft({ name, emoji, image });
                  setError(null);
                  void onAdd(draft).then((result) => {
                    if (result) {
                      reset();
                      setOpen(false);
                    }
                  });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not add that share.");
                }
              }}
            >
              Add share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
