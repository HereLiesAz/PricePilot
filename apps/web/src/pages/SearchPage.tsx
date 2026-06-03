import { useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import type { SearchResultDTO } from "@pricepilot/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddItem, useLists, useSearch } from "@/hooks/useLists";
import { formatPrice } from "@/lib/format";

export function SearchPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const { data: results, isFetching, isError, error } = useSearch(query);
  const { data: lists } = useLists();
  const [listId, setListId] = useState("");

  const targetList = listId || lists?.[0]?.id || "";

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Find products</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Search API-friendly vendors (eBay, Best Buy) by name, then add a result to a list.
          Requires vendor API credentials on the server.
        </p>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
        }}
        className="flex gap-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. wireless headphones"
          aria-label="Search query"
        />
        <Button type="submit" disabled={!input.trim()}>
          {isFetching ? <Loader2 className="animate-spin" /> : <Search />}
          Search
        </Button>
      </form>

      {lists && lists.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          Add results to:
          <select
            value={targetList}
            onChange={(e) => setListId(e.target.value)}
            className="h-9 rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {isError && (
        <p className="text-sm text-[var(--color-destructive)]">{(error as Error).message}</p>
      )}
      {results && results.length === 0 && query && !isFetching && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No results (or no vendor API credentials configured).
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results?.map((r) => (
          <ResultCard key={r.url} result={r} listId={targetList} />
        ))}
      </div>
    </div>
  );
}

function ResultCard({ result, listId }: { result: SearchResultDTO; listId: string }) {
  const addItem = useAddItem(listId);
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-1">
        <CardTitle className="text-sm">{result.title}</CardTitle>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {result.vendor} · {formatPrice(result.price, result.currency)}
        </span>
      </CardHeader>
      <CardContent>
        <Button
          size="sm"
          variant="outline"
          disabled={!listId || addItem.isPending || addItem.isSuccess}
          onClick={() => addItem.mutate({ url: result.url, qty: 1 })}
        >
          {addItem.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {addItem.isSuccess ? "Added" : "Add to list"}
        </Button>
      </CardContent>
    </Card>
  );
}
