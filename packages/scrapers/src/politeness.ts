/**
 * Scraping politeness (PLAN.md): respect robots.txt and apply per-domain rate
 * limiting with jitter. The parser and limiter are pure/injectable so they're
 * unit-testable; `fetch.ts` wires them into the HTTP path, gated by context
 * flags (off in tests, on for api/worker).
 */

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

/**
 * Parse robots.txt for the most specific matching user-agent group (the named
 * agent, falling back to `*`). Returns the Allow/Disallow path prefixes.
 */
export function parseRobots(txt: string, userAgent: string): RobotsRules {
  const uaToken = userAgent.toLowerCase().split("/")[0]!; // "PricePilotBot/0.2" -> "pricepilotbot"
  const groups = new Map<string, RobotsRules>();
  let current: string[] = [];
  let sawDirective = false;

  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      // A new group starts after directives were seen for the previous one.
      if (sawDirective) current = [];
      sawDirective = false;
      const agent = value.toLowerCase();
      if (!groups.has(agent)) groups.set(agent, { allow: [], disallow: [] });
      current.push(agent);
    } else if (field === "disallow" || field === "allow") {
      sawDirective = true;
      for (const agent of current) {
        const rules = groups.get(agent)!;
        if (value) rules[field === "allow" ? "allow" : "disallow"].push(value);
        else if (field === "disallow") {
          // "Disallow:" (empty) means allow all — clear disallows.
          rules.disallow = [];
        }
      }
    }
  }

  return groups.get(uaToken) ?? groups.get("*") ?? { allow: [], disallow: [] };
}

/**
 * Whether `path` is allowed by the rules. Longest matching directive wins; an
 * Allow ties-break over a Disallow of equal length. Default is allowed.
 */
export function isPathAllowed(path: string, rules: RobotsRules): boolean {
  const match = (list: string[]): number =>
    list.filter((p) => path.startsWith(p)).reduce((max, p) => Math.max(max, p.length), -1);
  const allow = match(rules.allow);
  const disallow = match(rules.disallow);
  if (disallow === -1) return true;
  return allow >= disallow;
}

/** Per-host minimum spacing between requests, with jitter. */
export class RateLimiter {
  private readonly nextAllowed = new Map<string, number>();

  constructor(
    private readonly minIntervalMs: number,
    private readonly jitterMs = 0,
  ) {}

  /** Resolve once the host is clear to be hit again, reserving the next slot. */
  async wait(
    host: string,
    now: () => number = Date.now,
    sleep: (ms: number) => Promise<void> = defaultSleep,
  ): Promise<void> {
    const t = now();
    const earliest = this.nextAllowed.get(host) ?? 0;
    const waitMs = Math.max(0, earliest - t);
    const jitter = this.jitterMs > 0 ? Math.random() * this.jitterMs : 0;
    this.nextAllowed.set(host, Math.max(t, earliest) + this.minIntervalMs + jitter);
    if (waitMs > 0) await sleep(waitMs);
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
