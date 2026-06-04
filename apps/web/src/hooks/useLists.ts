import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddItemInput,
  CreateAlertInput,
  CreateListInput,
  ImportInput,
} from "@pricepilot/shared";
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

export function useImportWishlist(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => listsApi.importWishlist(listId, url),
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
    onSuccess: (_offer, offerId) => {
      void qc.invalidateQueries({ queryKey: listKey(listId) });
      void qc.invalidateQueries({ queryKey: ["offer-history", offerId] });
    },
  });
}

export function useOfferHistory(offerId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["offer-history", offerId],
    queryFn: ({ signal }) => listsApi.offerHistory(offerId, signal),
    enabled,
  });
}

const alertsKey = (listId: string, itemId: string) => ["alerts", listId, itemId] as const;

export function useItemAlerts(listId: string, itemId: string, enabled: boolean) {
  return useQuery({
    queryKey: alertsKey(listId, itemId),
    queryFn: ({ signal }) => listsApi.itemAlerts(listId, itemId, signal),
    enabled,
  });
}

export function useCreateAlert(listId: string, itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAlertInput) => listsApi.createAlert(listId, itemId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: alertsKey(listId, itemId) }),
  });
}

export function useDeleteAlert(listId: string, itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => listsApi.deleteAlert(alertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: alertsKey(listId, itemId) }),
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: ({ signal }) => listsApi.search(query, signal),
    enabled: query.trim().length > 0,
  });
}
