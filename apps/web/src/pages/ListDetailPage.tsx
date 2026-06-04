import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, LineChart, Loader2, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import type { AlertRule, ListItemDTO } from "@pricepilot/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/Sparkline";
import { DealBadge } from "@/components/DealBadge";
import {
  useAddItem,
  useCreateAlert,
  useDeleteAlert,
  useImportList,
  useItemAlerts,
  useList,
  useOfferHistory,
  useRefreshOffer,
  useRemoveItem,
} from "@/hooks/useLists";
import { formatPrice, timeAgo } from "@/lib/format";

export function ListDetailPage() {
  const { id = "" } = useParams();
  const { data: list, isPending, isError, error } = useList(id);

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="size-4 animate-spin" /> Loading list…
      </p>
    );
  }
  if (isError || !list) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <p className="text-sm text-[var(--color-destructive)]">
          {(error as Error)?.message ?? "List not found."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{list.name}</h1>
        <Badge variant="secondary">{list.type.toLowerCase()}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AddItemCard listId={id} />
        <ImportCard listId={id} />
      </div>

      <ItemsTable items={list.items} listId={id} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex w-fit items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
    >
      <ArrowLeft className="size-4" /> All lists
    </Link>
  );
}

function AddItemCard({ listId }: { listId: string }) {
  const addItem = useAddItem(listId);
  const [value, setValue] = useState("");
  const [target, setTarget] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    const isUrl = /^https?:\/\//i.test(trimmed);
    const targetPrice = target ? Number(target) : undefined;
    addItem.mutate(
      {
        ...(isUrl ? { url: trimmed } : { title: trimmed }),
        ...(targetPrice !== undefined && Number.isFinite(targetPrice) ? { targetPrice } : {}),
        qty: 1,
      },
      { onSuccess: () => { setValue(""); setTarget(""); } },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add an item</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste a product URL, or type a name"
            aria-label="Product URL or name"
          />
          <div className="flex gap-3">
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Target price (optional)"
              aria-label="Target price"
              type="number"
              min="0"
              step="0.01"
            />
            <Button type="submit" disabled={addItem.isPending || !value.trim()}>
              {addItem.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Add
            </Button>
          </div>
        </form>
        {addItem.isError && (
          <p className="mt-2 text-sm text-[var(--color-destructive)]">
            {(addItem.error as Error).message}
          </p>
        )}
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
          URLs are resolved server-side via structured-data extraction. Amazon is
          off by default.
        </p>
      </CardContent>
    </Card>
  );
}

function ImportCard({ listId }: { listId: string }) {
  const importList = useImportList(listId);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [data, setData] = useState("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormat(file.name.endsWith(".json") ? "json" : "csv");
    void file.text().then(setData);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data.trim()) return;
    importList.mutate({ format, data }, { onSuccess: () => setData("") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bulk import (CSV / JSON)</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Textarea
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder={"title,url,targetPrice\nHeadphones,https://shop/hp,99.99"}
            aria-label="Import data"
            rows={4}
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as "csv" | "json")}
              aria-label="Import format"
              className="h-9 rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <Input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={onFile}
              aria-label="Upload file"
              className="h-9 w-auto py-1.5 text-xs"
            />
            <Button type="submit" disabled={importList.isPending || !data.trim()}>
              {importList.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              Import
            </Button>
          </div>
        </form>
        {importList.data && (
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Imported {importList.data.added} item
            {importList.data.added === 1 ? "" : "s"}
            {importList.data.failed.length > 0 &&
              `, ${importList.data.failed.length} failed`}
            .
          </p>
        )}
        {importList.isError && (
          <p className="mt-2 text-sm text-[var(--color-destructive)]">
            {(importList.error as Error).message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ItemsTable({ items, listId }: { items: ListItemDTO[]; listId: string }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No items yet — add one by URL or name, or bulk-import above.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--color-muted-foreground)]">
          <tr className="border-b border-[var(--color-border)]">
            <th className="px-4 py-2 font-medium">Product</th>
            <th className="px-4 py-2 font-medium">Best price</th>
            <th className="px-4 py-2 font-medium">Target</th>
            <th className="px-4 py-2 font-medium">Checked</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} listId={listId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemRow({ item, listId }: { item: ListItemDTO; listId: string }) {
  const refresh = useRefreshOffer(listId);
  const remove = useRemoveItem(listId);
  const [showHistory, setShowHistory] = useState(false);
  const best = item.bestOffer;
  const belowTarget =
    best?.price != null && item.targetPrice != null && best.price <= item.targetPrice;

  return (
    <>
      <tr className="border-b border-[var(--color-border)] last:border-0">
        <td className="px-4 py-3">
          <div className="font-medium">{item.product.normalizedTitle}</div>
          {best && (
            <a
              href={best.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[var(--color-muted-foreground)] hover:underline"
            >
              {best.vendor.domain}
            </a>
          )}
        </td>
        <td className="px-4 py-3">
          {best ? (
            <span className="inline-flex items-center gap-2">
              {formatPrice(best.price, best.currency)}
              {belowTarget && <Badge variant="success">target</Badge>}
              {best.inStock === false && <Badge variant="destructive">out</Badge>}
            </span>
          ) : (
            <span className="text-[var(--color-muted-foreground)]">no offer</span>
          )}
        </td>
        <td className="px-4 py-3">{formatPrice(item.targetPrice)}</td>
        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
          {timeAgo(best?.lastCheckedAt ?? null)}
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1">
            {best && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Price history"
                  aria-pressed={showHistory}
                  onClick={() => setShowHistory((v) => !v)}
                >
                  <LineChart />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Refresh price"
                  onClick={() => refresh.mutate(best.id)}
                  disabled={refresh.isPending}
                >
                  <RefreshCw className={refresh.isPending ? "animate-spin" : ""} />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove item"
              onClick={() => remove.mutate(item.id)}
              disabled={remove.isPending}
            >
              <Trash2 />
            </Button>
          </div>
        </td>
      </tr>
      {best && showHistory && (
        <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/30">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex flex-col gap-4">
              <HistoryPanel offerId={best.id} currency={best.currency} />
              <AlertsSection listId={listId} item={item} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function HistoryPanel({ offerId, currency }: { offerId: string; currency: string }) {
  const { data, isPending, isError } = useOfferHistory(offerId, true);

  if (isPending) {
    return (
      <span className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
        <Loader2 className="size-3 animate-spin" /> Loading history…
      </span>
    );
  }
  if (isError || !data) {
    return <span className="text-xs text-[var(--color-destructive)]">Could not load history.</span>;
  }

  const values = data.points.map((p) => p.price);
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex flex-col gap-2">
        <Sparkline values={values} />
        <DealBadge tier={data.deal.tier} percentile={data.deal.percentile} />
      </div>
      <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-[var(--color-muted-foreground)]">Lowest</dt>
        <dd>{formatPrice(data.lowest, currency)}</dd>
        <dt className="text-[var(--color-muted-foreground)]">Median</dt>
        <dd>{formatPrice(data.median, currency)}</dd>
        <dt className="text-[var(--color-muted-foreground)]">Latest</dt>
        <dd>{formatPrice(data.latest, currency)}</dd>
        <dt className="text-[var(--color-muted-foreground)]">Points</dt>
        <dd>{data.points.length}</dd>
      </dl>
    </div>
  );
}

const ALERT_LABELS: Record<AlertRule, string> = {
  TARGET_HIT: "Target hit",
  GOOD_DEAL: "Good deal",
  BACK_IN_STOCK: "Back in stock",
};

function AlertsSection({ listId, item }: { listId: string; item: ListItemDTO }) {
  const { data: alerts } = useItemAlerts(listId, item.id, true);
  const createAlert = useCreateAlert(listId, item.id);
  const deleteAlert = useDeleteAlert(listId, item.id);

  const existingRules = new Set((alerts ?? []).map((a) => a.rule));

  function add(rule: AlertRule) {
    // TARGET_HIT needs a threshold; use the item's target price.
    const threshold = rule === "TARGET_HIT" ? (item.targetPrice ?? undefined) : undefined;
    createAlert.mutate({ rule, channel: "WEB_PUSH", threshold });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-[var(--color-muted-foreground)]">Alerts</span>
      <div className="flex flex-wrap items-center gap-2">
        {(alerts ?? []).map((a) => (
          <Badge key={a.id} variant="secondary" className="gap-1">
            {ALERT_LABELS[a.rule]}
            {a.threshold != null && ` ≤ ${formatPrice(a.threshold)}`}
            <button
              type="button"
              aria-label={`Remove ${ALERT_LABELS[a.rule]} alert`}
              className="ml-1 hover:text-[var(--color-destructive)]"
              onClick={() => deleteAlert.mutate(a.id)}
            >
              ×
            </button>
          </Badge>
        ))}
        {(["TARGET_HIT", "GOOD_DEAL", "BACK_IN_STOCK"] as AlertRule[])
          .filter((rule) => !existingRules.has(rule))
          .map((rule) => {
            const needsTarget = rule === "TARGET_HIT" && item.targetPrice == null;
            return (
              <Button
                key={rule}
                variant="outline"
                size="sm"
                disabled={needsTarget || createAlert.isPending}
                title={needsTarget ? "Set a target price first" : undefined}
                onClick={() => add(rule)}
              >
                + {ALERT_LABELS[rule]}
              </Button>
            );
          })}
      </div>
      {createAlert.isError && (
        <p className="text-xs text-[var(--color-destructive)]">
          {(createAlert.error as Error).message}
        </p>
      )}
    </div>
  );
}
