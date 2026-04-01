import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/StatCard";
import { useDashboardStats } from "@/hooks/use-stats";
import { 
  Banknote, 
  TrendingUp, 
  AlertTriangle, 
  Package,
  Calendar,
  Wallet,
  ShoppingCart,
  Receipt,
  Building,
  FileText,
  DollarSign,
  Download,
  Key,
  Copy,
  Check,
  TrendingDown,
  PiggyBank,
  CircleDollarSign,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useLanguage } from "@/i18n/LanguageContext";

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const [copied, setCopied] = useState(false);
  const { t, isRtl } = useLanguage();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2 mt-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  const grossProfit = (stats?.monthlySalesTotal || 0) - (stats?.monthlyPurchaseCost || 0);
  const netProfit = grossProfit - (stats?.monthlyTotalExpenses || 0);
  const profitMargin = stats?.monthlySalesTotal ? ((netProfit / stats.monthlySalesTotal) * 100).toFixed(1) : "0";

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#C9784E] via-[#D4A574] to-[#8B7355] flex items-center justify-center shadow-lg">
            <BarChart3 className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#C9784E] to-[#8B7355] bg-clip-text text-transparent">{t.dashboard.title}</h1>
            <p className="text-muted-foreground mt-1">{t.dashboard.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline"
            className="border-primary/30 gap-2"
            onClick={async () => {
              try {
                const res = await fetch('/api/user/api-key', { 
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include'
                });
                
                if (!res.ok) {
                  const errorData = await res.json();
                  throw new Error(errorData.message || `${t.dashboard.apiKeyServerError} ${res.status}`);
                }
                
                const data = await res.json();
                if (!data || !data.apiKey) throw new Error(t.dashboard.apiKeyInvalid);

                const apiKey = data.apiKey;
                const msg = `${t.dashboard.apiKeyGenerated}\n${apiKey}\n\n${t.dashboard.apiKeySaveWarning}`;
                
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(apiKey);
                  alert(`${msg}\n\n${t.dashboard.apiKeyCopied}`);
                } else {
                  alert(msg);
                }
              } catch (error: any) {
                console.error("Error generating API key:", error);
                alert(`${t.dashboard.apiKeyError} ${error.message || t.dashboard.connectionFailed}`);
              }
            }}
            data-testid="button-generate-api-key"
          >
            <Key className="w-4 h-4" />
            {t.dashboard.generateApiKey}
          </Button>
          <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-xl shadow-sm border border-border/50">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{new Date().toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</span>
          </div>
        </div>
      </div>

      {/* Section 1: Daily Data */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-lg font-bold">{t.dashboard.dailyData}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 stagger-children">
          <Card className="relative overflow-hidden bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-emerald-300/50 dark:border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.25)] transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.todaySales}</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats?.todaySales?.toLocaleString() || 0} {t.common.currency}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                  <Banknote className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-blue-300/50 dark:border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:shadow-[0_0_25px_rgba(59,130,246,0.25)] transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.ordersCount}</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats?.todayOrdersCount || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-amber-300/50 dark:border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:shadow-[0_0_25px_rgba(245,158,11,0.25)] transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.todayExpenses}</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats?.todayVariableExpenses?.toLocaleString() || 0} {t.common.currency}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.dashboard.excludingFixed}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`relative overflow-hidden bg-white/60 dark:bg-card/40 backdrop-blur-xl transition-all duration-300 ${
            stats?.todayActualProfit && stats.todayActualProfit > 0 
              ? 'border border-green-300/50 dark:border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)] hover:shadow-[0_0_25px_rgba(34,197,94,0.25)]' 
              : 'border border-red-300/50 dark:border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)] hover:shadow-[0_0_25px_rgba(239,68,68,0.25)]'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.todayNetProfit}</p>
                  <p className={`text-2xl font-bold mt-1 ${stats?.todayActualProfit && stats.todayActualProfit > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {stats?.todayActualProfit?.toLocaleString() || 0} {t.common.currency}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{t.dashboard.salesMinusCostMinusExpenses}</p>
                </div>
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-lg ${
                  stats?.todayActualProfit && stats.todayActualProfit > 0 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-500' 
                    : 'bg-gradient-to-br from-red-500 to-rose-500'
                }`}>
                  {stats?.todayActualProfit && stats.todayActualProfit > 0 
                    ? <ArrowUpRight className="w-6 h-6 text-white" />
                    : <ArrowDownRight className="w-6 h-6 text-white" />
                  }
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-purple-300/50 dark:border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)] hover:shadow-[0_0_25px_rgba(168,85,247,0.25)] transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.soldItemsCost}</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats?.todaySoldItemsCost?.toLocaleString() || 0} {t.common.currency}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.dashboard.purchasePriceOfSold}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shadow-lg">
                  <Package className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alerts */}
        {stats?.lowStockProducts && stats.lowStockProducts.length > 0 && (
          <Card className="mt-4 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 dark:border-orange-800/30 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-orange-800 dark:text-orange-300 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {t.dashboard.stockAlerts} ({stats.lowStockProducts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {stats.lowStockProducts.map((p) => (
                  <div key={p.id} className="bg-white dark:bg-card px-3 py-2 rounded-xl border border-orange-200 dark:border-orange-800/30 text-sm shadow-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-orange-600 dark:text-orange-400 mr-2">
                      ({t.dashboard.remaining} {p.quantity} / {t.dashboard.minimum} {p.minStockLevel})
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Section 2: Financial Summary - NEW ENHANCED SECTION */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-lg font-bold">{t.dashboard.monthlyAccountsSummary}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
          <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-emerald-300/50 dark:border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.totalRevenue}</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{(stats?.monthlySalesTotal || 0).toLocaleString()} {t.common.currency}</p>
                  <div className="flex items-center gap-1 mt-2 text-emerald-600">
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="text-xs">{t.dashboard.monthlySales}</span>
                  </div>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                  <CircleDollarSign className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-red-300/50 dark:border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.totalExpenses}</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{(stats?.monthlyTotalExpenses || 0).toLocaleString()} {t.common.currency}</p>
                  <div className="flex items-center gap-1 mt-2 text-red-500">
                    <ArrowDownRight className="w-4 h-4" />
                    <span className="text-xs">{t.dashboard.fixedPlusVariable}</span>
                  </div>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-lg">
                  <TrendingDown className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-white/60 dark:bg-card/40 backdrop-blur-xl transition-all duration-300 ${
            netProfit >= 0 
              ? 'border border-green-300/50 dark:border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]' 
              : 'border border-red-300/50 dark:border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.netProfit}</p>
                  <p className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {netProfit.toLocaleString()} {t.common.currency}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-muted-foreground">
                    <Calculator className="w-4 h-4" />
                    <span className="text-xs">{t.dashboard.revenueMinusAllExpenses}</span>
                  </div>
                </div>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                  netProfit >= 0 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-500' 
                    : 'bg-gradient-to-br from-red-500 to-rose-500'
                }`}>
                  <PiggyBank className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-indigo-300/50 dark:border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)] hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.profitMargin}</p>
                  <p className={`text-2xl font-bold mt-1 ${parseFloat(profitMargin) >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`}>
                    {profitMargin}%
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-muted-foreground">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs">{t.dashboard.netProfitMargin}</span>
                  </div>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 3: Inventory & Purchases */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 stagger-children">
        <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-sky-300/50 dark:border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.1)] hover:shadow-[0_0_20px_rgba(14,165,233,0.2)] transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-sky-700 dark:text-sky-300 flex items-center gap-2">
              <Package className="w-5 h-5" />
              {t.dashboard.inventoryValue}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">
                  {(stats?.totalInventoryCost || 0).toLocaleString()} {t.common.currency}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.dashboard.totalPurchaseCostOfInventory}
                </p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-violet-300/50 dark:border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.1)] hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-violet-700 dark:text-violet-300 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {t.dashboard.monthlyPurchases}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                  {(stats?.monthlyPurchaseCost || 0).toLocaleString()} {t.common.currency}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.dashboard.purchasedGoodsCost}
                </p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 4: Fixed Expenses */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Building className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-lg font-bold">{t.dashboard.monthlyFixedExpenses}</h2>
        </div>
        <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-amber-300/50 dark:border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
          <CardHeader className="pb-2 border-b border-amber-200/30 dark:border-amber-700/30">
            <CardTitle className="text-base font-medium flex items-center justify-between">
              <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Receipt className="w-4 h-4" />
                {t.dashboard.totalLabel} {(stats?.monthlyFixedExpenses || 0).toLocaleString()} {t.common.currency}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {stats?.fixedExpenses && stats.fixedExpenses.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
                {stats.fixedExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between p-4 bg-white/50 dark:bg-card/30 rounded-xl border border-amber-200/50 dark:border-amber-700/30 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow">
                        <Building className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{expense.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(expense.date), "dd MMMM", isRtl ? { locale: ar } : {})}
                        </p>
                      </div>
                    </div>
                    <p className="font-bold text-amber-700 dark:text-amber-400">
                      {expense.amount.toLocaleString()} {t.common.currency}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-white/30 dark:bg-card/20 rounded-xl border-2 border-dashed border-amber-300/50 dark:border-amber-600/30">
                <Building className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>{t.dashboard.noFixedExpenses}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 5: Aggregate Reports */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-lg font-bold">{t.dashboard.aggregateReports}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
          <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-primary/30 shadow-[0_0_15px_rgba(201,120,78,0.1)] hover:shadow-[0_0_20px_rgba(201,120,78,0.2)] transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.weeklySales}</p>
                  <p className="text-2xl font-bold text-primary mt-1">{(stats?.weeklySalesTotal || 0).toLocaleString()} {t.common.currency}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-green-300/50 dark:border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.2)] transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.monthlySales}</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{(stats?.monthlySalesTotal || 0).toLocaleString()} {t.common.currency}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-orange-300/50 dark:border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)] hover:shadow-[0_0_20px_rgba(249,115,22,0.2)] transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.variableExpenses}</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                    {((stats?.monthlyTotalExpenses || 0) - (stats?.monthlyFixedExpenses || 0)).toLocaleString()} {t.common.currency}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-rose-300/50 dark:border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)] hover:shadow-[0_0_20px_rgba(244,63,94,0.2)] transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t.dashboard.totalMonthlyExpenses}</p>
                  <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{(stats?.monthlyTotalExpenses || 0).toLocaleString()} {t.common.currency}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.dashboard.fixedPlusVariable}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center shadow-lg">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 6: Reports Download */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {/* Daily Report */}
        <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-teal-300/50 dark:border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.15)] hover:shadow-[0_0_30px_rgba(20,184,166,0.25)] transition-all duration-300">
          <CardContent className="py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-teal-700 dark:text-teal-300">{t.dashboard.dailyReport}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t.dashboard.dailySummaryDescription}
                  </p>
                  <p className="text-xs text-teal-600/60 dark:text-teal-400/60 mt-1">
                    {t.dashboard.autoSentDaily}
                  </p>
                </div>
              </div>
              <Button 
                className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:from-teal-600 hover:to-emerald-600 shadow-lg"
                onClick={() => window.open('/api/reports/daily/download', '_blank')}
                data-testid="button-download-daily-report"
              >
                <Download className="w-4 h-4 ml-2" />
                {t.dashboard.downloadPdf}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Report */}
        <Card className="bg-white/60 dark:bg-card/40 backdrop-blur-xl border border-violet-300/50 dark:border-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.15)] hover:shadow-[0_0_30px_rgba(139,92,246,0.25)] transition-all duration-300">
          <CardContent className="py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-violet-700 dark:text-violet-300">{t.dashboard.monthlyReport}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t.dashboard.salesExpensesProfits}
                  </p>
                  <p className="text-xs text-violet-600/60 dark:text-violet-400/60 mt-1">
                    {t.dashboard.autoSentEmail}
                  </p>
                </div>
              </div>
              <Button 
                className="bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 shadow-lg"
                onClick={() => window.open('/api/reports/monthly/download', '_blank')}
                data-testid="button-download-report"
              >
                <Download className="w-4 h-4 ml-2" />
                {t.dashboard.downloadPdf}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
