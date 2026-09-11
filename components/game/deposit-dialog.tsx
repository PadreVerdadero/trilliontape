"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCoins, formatNumber } from "@/lib/game/format";

export function DepositDialog({
  deposit,
}: {
  deposit: { amount: number; day: number; gold: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(deposit);
  const opened = useRef(false);

  useEffect(() => {
    if (!deposit || opened.current) return;
    opened.current = true;
    setShown(deposit);
    setOpen(true);
  }, [deposit]);

  if (!shown) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Daily deposit</DialogTitle>
          <DialogDescription>
            Day {formatNumber(shown.day)} purse just landed in your coins.
          </DialogDescription>
        </DialogHeader>
        <p className="font-heading text-center text-4xl tabular-nums text-primary">
          +{formatCoins(shown.amount)}
        </p>
        <p className="text-center text-sm text-muted-foreground">
          You now have {formatCoins(shown.gold)}.
        </p>
        <DialogFooter>
          <Button className="w-full sm:w-auto" onClick={() => setOpen(false)}>
            Sit down
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
