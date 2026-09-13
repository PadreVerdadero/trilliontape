import { cn } from "@/lib/utils";

export function ItemIcon({
  item,
  className,
}: {
  item?: { emoji?: string; name?: string; image?: string | null } | null;
  className?: string;
}) {
  if (item?.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.image}
        alt=""
        className={cn("inline-block size-[1.15em] object-contain align-[-0.15em]", className)}
      />
    );
  }
  return <span className={className}>{item?.emoji || "?"}</span>;
}
