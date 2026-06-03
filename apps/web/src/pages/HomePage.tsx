import { useState } from "react";
import { Link } from "react-router-dom";
import { ListPlus, Loader2, Package, Trash2 } from "lucide-react";
import type { ListType } from "@pricepilot/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCreateList, useDeleteList, useLists } from "@/hooks/useLists";

export function HomePage() {
  const { data: lists, isPending, isError, error } = useLists();
  const createList = useCreateList();
  const deleteList = useDeleteList();

  const [name, setName] = useState("");
  const [type, setType] = useState<ListType>("SHOPPING");

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createList.mutate({ name: trimmed, type }, { onSuccess: () => setName("") });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your lists</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Track shopping &amp; wish lists across vendors and keep the best possible price.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New list</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Home office upgrades"
              aria-label="List name"
              maxLength={120}
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ListType)}
              aria-label="List type"
              className="h-9 rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm"
            >
              <option value="SHOPPING">Shopping</option>
              <option value="WISHLIST">Wishlist</option>
            </select>
            <Button type="submit" disabled={createList.isPending || !name.trim()}>
              {createList.isPending ? <Loader2 className="animate-spin" /> : <ListPlus />}
              Create
            </Button>
          </form>
          {createList.isError && (
            <p className="mt-2 text-sm text-[var(--color-destructive)]">
              {(createList.error as Error).message}
            </p>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        {isPending && (
          <p className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
            <Loader2 className="size-4 animate-spin" /> Loading lists…
          </p>
        )}
        {isError && (
          <p className="text-sm text-[var(--color-destructive)]">
            Could not load lists: {(error as Error).message}
          </p>
        )}
        {lists && lists.length === 0 && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No lists yet — create one above to get started.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists?.map((list) => (
            <Card key={list.id} className="flex flex-col">
              <CardHeader className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">
                    <Link to={`/lists/${list.id}`} className="hover:underline">
                      {list.name}
                    </Link>
                  </CardTitle>
                  <Badge variant="secondary">{list.type.toLowerCase()}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]">
                  <Package className="size-4" /> {list.itemCount} item
                  {list.itemCount === 1 ? "" : "s"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${list.name}`}
                  onClick={() => deleteList.mutate(list.id)}
                  disabled={deleteList.isPending}
                >
                  <Trash2 />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
