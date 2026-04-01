import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Package, Calendar, Phone, User, Trash2, Edit2, Image, Upload, X } from "lucide-react";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CustomOrder, User as UserType } from "@shared/schema";
import { useLanguage } from "@/i18n/LanguageContext";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
};

export default function CustomOrders() {
  const { t, isRtl, dir } = useLanguage();
  const { data: orders, isLoading } = useQuery<CustomOrder[]>({ 
    queryKey: ["/api/custom-orders"] 
  });
  const { data: currentUser } = useQuery<UserType>({ queryKey: ["/api/user"] });
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomOrder | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [productName, setProductName] = useState("");
  const [details, setDetails] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [amountRemaining, setAmountRemaining] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("pending");

  const canDelete = currentUser?.role === "owner" || currentUser?.role === "manager";

  const statusLabels: Record<string, string> = {
    pending: t.customOrders.pending,
    in_progress: t.customOrders.inProgress,
    completed: t.customOrders.completed,
    cancelled: t.customOrders.cancelled
  };

  const resetForm = () => {
    setProductName("");
    setDetails("");
    setAmountPaid("");
    setAmountRemaining("");
    setDeliveryDate("");
    setCustomerName("");
    setCustomerPhone("");
    setImageUrl("");
    setStatus("pending");
    setEditingOrder(null);
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/custom-orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-orders"] });
      toast({ title: t.customOrders.addSuccess });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/custom-orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-orders"] });
      toast({ title: t.customOrders.updateSuccess });
      setIsEditDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/custom-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-orders"] });
      toast({ title: t.customOrders.deleteSuccess });
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      productName,
      details: details || null,
      amountPaid: amountPaid || "0",
      amountRemaining: amountRemaining || "0",
      deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : null,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      imageUrl: imageUrl || null,
      status
    };

    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const openEditDialog = (order: CustomOrder) => {
    setEditingOrder(order);
    setProductName(order.productName);
    setDetails(order.details || "");
    setAmountPaid(order.amountPaid?.toString() || "");
    setAmountRemaining(order.amountRemaining?.toString() || "");
    setDeliveryDate(order.deliveryDate ? format(new Date(order.deliveryDate), "yyyy-MM-dd") : "");
    setCustomerName(order.customerName || "");
    setCustomerPhone(order.customerPhone || "");
    setImageUrl(order.imageUrl || "");
    setStatus(order.status);
    setIsEditDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t.common.error, description: t.customOrders.fileTooLarge, variant: "destructive" });
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      if (!response.ok) throw new Error("Upload failed");
      
      const { url } = await response.json();
      setImageUrl(url);
      toast({ title: t.customOrders.uploadSuccess });
    } catch (error) {
      toast({ title: t.common.error, description: t.customOrders.uploadError, variant: "destructive" });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="productName">{t.customOrders.productName} *</Label>
        <Input
          id="productName"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder={t.customOrders.productName}
          required
          data-testid="input-product-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="details">{t.customOrders.description}</Label>
        <Textarea
          id="details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={t.customOrders.details}
          rows={3}
          data-testid="input-details"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amountPaid">{t.customOrders.amountPaid}</Label>
          <Input
            id="amountPaid"
            type="number"
            step="0.01"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="0"
            data-testid="input-amount-paid"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amountRemaining">{t.customOrders.amountRemaining}</Label>
          <Input
            id="amountRemaining"
            type="number"
            step="0.01"
            value={amountRemaining}
            onChange={(e) => setAmountRemaining(e.target.value)}
            placeholder="0"
            data-testid="input-amount-remaining"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="deliveryDate">{t.customOrders.deadline}</Label>
        <Input
          id="deliveryDate"
          type="date"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          data-testid="input-delivery-date"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customerName">{t.customOrders.customerName}</Label>
          <Input
            id="customerName"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={t.customOrders.customerName}
            data-testid="input-customer-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customerPhone">{t.customOrders.phone}</Label>
          <Input
            id="customerPhone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder={t.customOrders.phone}
            data-testid="input-customer-phone"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t.customOrders.imageFile}</Label>
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="flex-1"
            >
              <Upload className="w-4 h-4 ml-2" />
              {uploadingImage ? t.customOrders.uploading : t.customOrders.uploadImage}
            </Button>
          </div>
          {imageUrl && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <Image className="w-4 h-4 text-primary" />
              <span className="text-sm flex-1 truncate">{imageUrl.split('/').pop()}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setImageUrl("")}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">{t.customOrders.status}</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger data-testid="select-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">{t.customOrders.pending}</SelectItem>
            <SelectItem value="in_progress">{t.customOrders.inProgress}</SelectItem>
            <SelectItem value="completed">{t.customOrders.completed}</SelectItem>
            <SelectItem value="cancelled">{t.customOrders.cancelled}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-order">
          {editingOrder ? t.customOrders.updateOrder : t.customOrders.addOrder}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t.customOrders.title}</h1>
            <p className="text-muted-foreground mt-1">{t.customOrders.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 bg-white dark:bg-card px-4 py-2 rounded-lg border border-border/50 shadow-sm">
              <Package className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">{t.customOrders.totalOrders}</span>
                <span className="text-lg font-bold">{orders?.length || 0}</span>
              </div>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2" data-testid="button-add-order">
                  <Plus className="w-4 h-4" />
                  {t.customOrders.addOrder}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t.customOrders.newOrder}</DialogTitle>
                </DialogHeader>
                {formContent}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {t.customOrders.ordersList}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">{t.common.loading}</div>
            ) : !orders || orders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">{t.customOrders.noOrders}</div>
            ) : (
              <div className="space-y-4 stagger-children">
                {orders.map((order) => (
                  <div 
                    key={order.id} 
                    className="border border-border/50 rounded-lg p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg truncate">{order.productName}</h3>
                          <Badge className={statusColors[order.status]}>
                            {statusLabels[order.status]}
                          </Badge>
                        </div>
                        
                        {order.details && (
                          <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{order.details}</p>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">{t.customOrders.paid}:</span>
                            <p className="font-bold text-green-600">{Number(order.amountPaid || 0).toLocaleString()} {t.common.currency}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t.customOrders.remaining}:</span>
                            <p className="font-bold text-red-600">{Number(order.amountRemaining || 0).toLocaleString()} {t.common.currency}</p>
                          </div>
                          {order.deliveryDate && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span>{format(new Date(order.deliveryDate), "dd/MM/yyyy", ...(isRtl ? [{ locale: ar }] : []))}</span>
                            </div>
                          )}
                          {order.customerName && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span>{order.customerName}</span>
                            </div>
                          )}
                        </div>

                        {order.customerPhone && (
                          <div className="flex items-center gap-1.5 mt-2 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span>{order.customerPhone}</span>
                          </div>
                        )}

                        {order.imageUrl && (
                          <div className="mt-3">
                            <a 
                              href={order.imageUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                            >
                              <Image className="w-4 h-4" />
                              {t.customOrders.viewImageFile}
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => openEditDialog(order)}
                          data-testid={`button-edit-order-${order.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                data-testid={`button-delete-order-${order.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t.customOrders.deleteConfirm}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t.customOrders.deleteConfirmDesc} "{order.productName}"
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(order.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {t.customOrders.deleteOrder}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t.customOrders.editOrder}</DialogTitle>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
