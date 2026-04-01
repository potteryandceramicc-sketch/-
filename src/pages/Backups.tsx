import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { Database, Download, Trash2, Plus, Clock, HardDrive, Shield, AlertCircle, FileText, FileJson, Calendar, Upload } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/i18n/LanguageContext";

interface Backup {
  filename: string;
  createdAt: string;
  size: number;
  type: 'pdf' | 'json';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Backups() {
  const { t, isRtl, dir } = useLanguage();
  const { toast } = useToast();
  const { data: user } = useUser();
  const [deleteFilename, setDeleteFilename] = useState<string | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const isOwner = user?.role === "owner";

  const { data: backups, isLoading } = useQuery<Backup[]>({
    queryKey: ['/api/backups']
  });

  const createJsonBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/backups/create');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      toast({
        title: t.backups.backupCreated,
        description: `${data.filename}`,
      });
    },
    onError: () => {
      toast({
        title: t.common.error,
        description: t.backups.createJsonError,
        variant: "destructive",
      });
    }
  });

  const createPdfBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/backups/create-pdf');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      toast({
        title: t.backups.pdfCreated,
        description: `${data.filename}`,
      });
    },
    onError: () => {
      toast({
        title: t.common.error,
        description: t.backups.createPdfError,
        variant: "destructive",
      });
    }
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (filename: string) => {
      await apiRequest('DELETE', `/api/backups/${filename}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      toast({
        title: t.backups.backupDeleted,
      });
      setDeleteFilename(null);
    },
    onError: () => {
      toast({
        title: t.common.error,
        description: t.backups.deleteError,
        variant: "destructive",
      });
    }
  });

  const importBackupMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/backups/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || t.backups.importError);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/purchases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: t.backups.importSuccess,
      });
      setSelectedImportFile(null);
      setShowImportConfirm(false);
    },
    onError: (error: Error) => {
      toast({
        title: t.backups.importError,
        description: error.message,
        variant: "destructive",
      });
      setSelectedImportFile(null);
      setShowImportConfirm(false);
    }
  });

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      toast({ title: t.common.error, description: t.backups.jsonMustBeFormat, variant: "destructive" });
      return;
    }
    setSelectedImportFile(file);
    setShowImportConfirm(true);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleDownload = (filename: string, type: string) => {
    if (type === 'pdf') {
      window.open(`/api/backups/${filename}/download-pdf`, '_blank');
    } else {
      window.open(`/api/backups/${filename}/download`, '_blank');
    }
  };

  const pdfBackups = backups?.filter(b => b.type === 'pdf') || [];
  const jsonBackups = backups?.filter(b => b.type === 'json') || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#C9784E] to-[#8B7355] flex items-center justify-center shadow-lg">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#C9784E] to-[#8B7355] bg-clip-text text-transparent">
                  {t.backups.title}
                </h1>
                <p className="text-muted-foreground">{t.backups.subtitle}</p>
              </div>
            </div>
          </div>
          {isOwner && (
            <div className="flex gap-2 flex-wrap">
              <input
                ref={importFileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportFileSelect}
              />
              <Button 
                onClick={() => importFileRef.current?.click()} 
                disabled={importBackupMutation.isPending}
                variant="outline"
              >
                <Upload className="h-4 w-4 ml-2" />
                {importBackupMutation.isPending ? t.backups.importing : t.backups.importBackup}
              </Button>
              <Button 
                onClick={() => createPdfBackupMutation.mutate()} 
                disabled={createPdfBackupMutation.isPending}
                variant="destructive"
                data-testid="button-create-pdf-backup"
              >
                <FileText className="h-4 w-4 ml-2" />
                {createPdfBackupMutation.isPending ? t.backups.creating : t.backups.createPdfBackup}
              </Button>
              <Button 
                onClick={() => createJsonBackupMutation.mutate()} 
                disabled={createJsonBackupMutation.isPending}
                data-testid="button-create-backup"
              >
                <Plus className="h-4 w-4 ml-2" />
                {createJsonBackupMutation.isPending ? t.backups.creating : t.backups.createJsonBackup}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 stagger-children">
          <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-blue-200/50 dark:border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all duration-300" data-testid="card-backup-count">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.backups.backupCount}</CardTitle>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
                <Database className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-backup-count">{backups?.length || 0}</div>
              <p className="text-sm text-muted-foreground mt-1">{t.backups.savedBackup}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-red-200/50 dark:border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)] hover:shadow-[0_0_20px_rgba(239,68,68,0.25)] transition-all duration-300" data-testid="card-pdf-count">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.backups.pdfReports}</CardTitle>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center shadow-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400" data-testid="text-pdf-count">{pdfBackups.length}</div>
              <p className="text-sm text-muted-foreground mt-1">{t.backups.savedPdf}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-amber-200/50 dark:border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all duration-300" data-testid="card-last-backup">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.backups.lastBackup}</CardTitle>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400" data-testid="text-last-backup">
                {backups && backups.length > 0 
                  ? format(new Date(backups[0].createdAt), 'dd MMM yyyy', ...(isRtl ? [{ locale: ar }] : []))
                  : t.backups.noBackupYet
                }
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {backups && backups.length > 0 
                  ? format(new Date(backups[0].createdAt), 'HH:mm', ...(isRtl ? [{ locale: ar }] : []))
                  : ''
                }
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-emerald-200/50 dark:border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all duration-300" data-testid="card-total-size">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.backups.totalSize}</CardTitle>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                <HardDrive className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-total-size">
                {formatFileSize(backups?.reduce((sum, b) => sum + b.size, 0) || 0)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{t.backups.storageSpace}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg border-0 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle>{t.backups.autoBackup}</CardTitle>
                <CardDescription>
                  {t.backups.autoBackupDesc}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">{t.backups.autoBackupEnabled}</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {t.backups.autoBackupSchedule}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#C9784E] to-[#D4A574] flex items-center justify-center">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle>{t.backups.savedBackupsList}</CardTitle>
                <CardDescription>
                  {t.backups.savedBackupsDesc}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : backups && backups.length > 0 ? (
              <div className="space-y-3 stagger-children">
                {backups.map((backup) => (
                  <div 
                    key={backup.filename}
                    className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors"
                    data-testid={`backup-item-${backup.filename}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${backup.type === 'pdf' ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                        {backup.type === 'pdf' ? (
                          <FileText className={`h-6 w-6 text-red-500`} />
                        ) : (
                          <FileJson className={`h-6 w-6 text-blue-500`} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{backup.filename}</p>
                          <Badge variant={backup.type === 'pdf' ? 'destructive' : 'default'} className="text-xs">
                            {backup.type.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(backup.createdAt), 'dd/MM/yyyy HH:mm', ...(isRtl ? [{ locale: ar }] : []))}
                          </span>
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            {formatFileSize(backup.size)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(backup.filename, backup.type)}
                        data-testid={`button-download-${backup.filename}`}
                      >
                        <Download className="h-4 w-4 ml-1" />
                        {t.backups.downloadBackup}
                      </Button>
                      {isOwner && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteFilename(backup.filename)}
                          data-testid={`button-delete-${backup.filename}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t.backups.noBackups}</h3>
                <p className="text-muted-foreground mb-4">
                  {t.backups.savedBackupsDesc}
                </p>
                {isOwner && (
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => createPdfBackupMutation.mutate()} variant="outline">
                      <FileText className="h-4 w-4 ml-2" />
                      {t.backups.createPdfBackup}
                    </Button>
                    <Button onClick={() => createJsonBackupMutation.mutate()}>
                      <Plus className="h-4 w-4 ml-2" />
                      {t.backups.createJsonBackup}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {t.backups.importantNotes}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-amber-700 dark:text-amber-300 space-y-2">
            <p>• <strong>PDF</strong>: {t.backups.notePdf}</p>
            <p>• <strong>JSON</strong>: {t.backups.noteJson}</p>
            <p>• {t.backups.noteAutoBackup}</p>
            <p>• {t.backups.noteExternal}</p>
            <p>• {t.backups.noteOwnerOnly}</p>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteFilename} onOpenChange={() => setDeleteFilename(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.backups.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFilename && deleteBackupMutation.mutate(deleteFilename)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showImportConfirm} onOpenChange={(open) => { if (!open) { setShowImportConfirm(false); setSelectedImportFile(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">{t.backups.importWarningTitle}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-bold text-destructive">{t.backups.importWarningDesc}</p>
              <p>{t.backups.importWarningFile}: <strong>{selectedImportFile?.name}</strong></p>
              <p>{t.backups.importWarningAction}:</p>
              <ul className="list-disc list-inside space-y-1 mr-2">
                <li>{t.backups.allProducts}</li>
                <li>{t.backups.allSales}</li>
                <li>{t.backups.allPurchases}</li>
                <li>{t.backups.allExpenses}</li>
                <li>{t.backups.allCustomOrders}</li>
              </ul>
              <p className="font-bold">{t.backups.importWarningCannotUndo}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => { setShowImportConfirm(false); setSelectedImportFile(null); }}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedImportFile && importBackupMutation.mutate(selectedImportFile)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.backups.importBackup}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
