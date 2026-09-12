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

function depositKey(deposit: { amount: number; day: number }) {
  return `trillion_deposit_${deposit.day}_${deposit.amount}`;
}

function alreadyShown(key: string) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function rememberShown(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // Private mode can block storage; the server only sends this once per pay.
  }
}

export function DepositDialog({
  deposit,
}: {
  deposit: { amount: number; day: number; gold: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(deposit);
  const opened = useRef(false);

  useEffect(() => {
    if (!deposit) return;
    const key = depositKey(deposit);
    if (opened.current || alreadyShown(key)) return;
    opened.current = true;
    rememberShown(key);
    setShown(deposit);
    setOpen(true);
  }, [deposit]);

  if (!shown) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Coin drop</DialogTitle>
          <DialogDescription>
            Drop {formatNumber(shown.day)} just landed in your coins. The next one is in 5 minutes.
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
