import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="brand-lockup" aria-label="ClauseGate home">
      <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 8h7l10 8H4" />
        <path d="M4 16h17l7 8H4" />
        <path d="M4 24h17l7-8H14" />
      </svg>
      <span className="brand-wordmark">ClauseGate</span>
    </Link>
  );
}
