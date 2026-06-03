import { ListPlus, Search, Upload } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const importFlows = [
  {
    icon: ListPlus,
    title: "Paste product URLs",
    description: "Drop links from any store; we resolve the right adapter server-side.",
  },
  {
    icon: Upload,
    title: "CSV / JSON upload",
    description: "Bulk-import an existing list; columns get mapped automatically.",
  },
  {
    icon: Search,
    title: "Search by name",
    description: "Query API-friendly vendors and pick the right product.",
  },
];

export function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your lists</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Track shopping & wish lists across vendors and keep the best possible price.
          Importing and price tracking arrive in Phase 1 — this is the Phase 0 shell.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {importFlows.map((flow) => (
          <Card key={flow.title}>
            <CardHeader>
              <flow.icon className="size-6 text-[var(--color-primary)]" aria-hidden />
              <CardTitle>{flow.title}</CardTitle>
              <CardDescription>{flow.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" disabled>
                Coming in Phase 1
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
