import type { MatchResult } from "@/domain/matching";
import { topReasons } from "@/domain/matching";
import type { Translator } from "@/lib/i18n";
import { Badge, type Tone } from "./ui";

const TONE_BY_BAND: Record<MatchResult["band"], Tone> = {
  STRONG: "positive",
  GOOD: "accent",
  POSSIBLE: "neutral",
  WEAK: "neutral",
};

export function MatchBadge({ match, t }: { match: MatchResult; t: Translator }) {
  return (
    <Badge tone={TONE_BY_BAND[match.band]}>
      {match.score}% · {t(`match.band.${match.band}` as never)}
    </Badge>
  );
}

/** The reasons that carried the score, for cards where one line fits. */
export function MatchReasonLine({ match, t }: { match: MatchResult; t: Translator }) {
  const reasons = topReasons(match, 2);
  if (!reasons.length) return null;

  return (
    <p className="text-[12.5px] text-[var(--color-muted)]">
      {reasons.map((r) => t(r.key as never, r.values)).join(" · ")}
    </p>
  );
}

/** Full breakdown, used on the asset page and the buyer profile. */
export function MatchBreakdown({ match, t }: { match: MatchResult; t: Translator }) {
  return (
    <ul className="space-y-2.5">
      {match.reasons.map((reason) => (
        <li key={reason.factor} className="flex items-start gap-3">
          <span className="mt-1 h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--color-line)]">
            <span
              className="block h-full rounded-full bg-[var(--color-ink)]"
              style={{ width: `${(reason.points / reason.max) * 100}%` }}
            />
          </span>
          <span className="text-[13px] leading-snug text-[var(--color-ink-soft)]">
            {t(reason.key as never, reason.values)}
          </span>
        </li>
      ))}
    </ul>
  );
}
