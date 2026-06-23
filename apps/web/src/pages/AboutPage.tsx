import { useHealth } from "@/hooks/useHealth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AboutPage() {
  const { data, isError } = useHealth();

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">About Sail</h1>
        <p className="max-w-2xl text-[var(--color-muted-foreground)]">
          A PWA is browser JavaScript, and browsers block cross-origin requests to
          vendor sites. So price-fetching runs server-side: this app talks only to our
          own API, which leads with API-friendly vendors. Amazon stays opt-in and
          off-by-default. See <code>PLAN.md</code> for the full roadmap.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>API connection</CardTitle>
          <CardDescription>Live end-to-end health check (web ↔ api).</CardDescription>
        </CardHeader>
        <CardContent>
          {isError ? (
            <p className="text-sm text-[var(--color-destructive)]">
              Could not reach the API. Start it with{" "}
              <code>pnpm --filter @sail/api dev</code>.
            </p>
          ) : data ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              <dt className="text-[var(--color-muted-foreground)]">Status</dt>
              <dd>{data.status}</dd>
              <dt className="text-[var(--color-muted-foreground)]">Service</dt>
              <dd>{data.service}</dd>
              <dt className="text-[var(--color-muted-foreground)]">Version</dt>
              <dd>{data.version}</dd>
              <dt className="text-[var(--color-muted-foreground)]">Uptime</dt>
              <dd>{data.uptime.toFixed(1)}s</dd>
            </dl>
          ) : (
            <p className="text-sm text-[var(--color-muted-foreground)]">Checking…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
