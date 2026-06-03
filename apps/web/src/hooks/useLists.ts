import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AddItemInput, CreateListInput, ImportInput } from "@pricepilot/shared";
import { listsApi } from "@/lib/api";

const listsKey = ["lists"] as const;
const listKey = (id: string) => ["lists", id] as const;

export function useLists() {
  return useQuery({
    queryKey: listsKey,
    queryFn: ({ signal }) => listsApi.list(signal),
  });
}

export function useList(id: string) {
  return useQuery({
    queryKey: listKey(id),
    queryFn: ({ signal }) => listsApi.get(id, signal),
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateListInput) => listsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: listsKey }),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => listsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: listsKey }),
  });
}

export function useAddItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddItemInput) => listsApi.addItem(listId, input),
    onSuccess: (detail) => {
      qc.setQueryData(listKey(listId), detail);
      void qc.invalidateQueries({ queryKey: listsKey });
    },
  });
}

export function useRemoveItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => listsApi.removeItem(listId, itemId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: listKey(listId) });
      void qc.invalidateQueries({ queryKey: listsKey });
    },
  });
}

export function useImportList(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportInput) => listsApi.import(listId, input),
    onSuccess: (result) => {
      qc.setQueryData(listKey(listId), result.list);
      void qc.invalidateQueries({ queryKey: listsKey });
    },
  });
}

export function useRefreshOffer(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) => listsApi.refreshOffer(offerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey(listId) }),
  });
}
