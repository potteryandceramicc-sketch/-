import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type CreatePurchaseRequest } from "@shared/routes";

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePurchaseRequest) => {
      const res = await fetch(api.purchases.create.path, {
        method: api.purchases.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("فشل تسجيل الشراء");
      return api.purchases.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: [api.stats.dashboard.path] });
    },
  });
}

export function useDeletePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE', credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) throw new Error("غير مصرح لك بحذف المشتريات");
        throw new Error("فشل حذف عملية الشراء");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: [api.stats.dashboard.path] });
    },
  });
}
