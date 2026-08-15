import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="ClauseGate home">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-ink text-sm font-bold text-white">
        C
      </span>
      <span className="text-[1.05rem] font-semibold tracking-[-0.03em]">ClauseGate</span>
    </Link>
  );
}
