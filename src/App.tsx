import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/i18n/LanguageContext";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Pos from "@/pages/Pos";
import Purchases from "@/pages/Purchases";
import PurchasesLedger from "@/pages/PurchasesLedger";
import Expenses from "@/pages/Expenses";
import Users from "@/pages/Users";
import SalesLedger from "@/pages/SalesLedger";
import Invoices from "@/pages/Invoices";
import CustomOrders from "@/pages/CustomOrders";
import Analytics from "@/pages/Analytics";
import Backups from "@/pages/Backups";
import FundTransfers from "@/pages/FundTransfers";
import Settings from "@/pages/Settings";
import FloatingScannerButton from "@/components/FloatingScannerButton";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Dashboard} />
      <Route path="/products" component={Products} />
      <Route path="/pos" component={Pos} />
      <Route path="/purchases" component={Purchases} />
      <Route path="/purchases-ledger" component={PurchasesLedger} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/users" component={Users} />
      <Route path="/sales-ledger" component={SalesLedger} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/custom-orders" component={CustomOrders} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/backups" component={Backups} />
      <Route path="/fund-transfers" component={FundTransfers} />
      <Route path="/settings" component={Settings} />
      <Route path="/reports" component={Dashboard} /> 
      <Route component={NotFound} />
    </Switch>
  );
}

const themeColorMap: Record<string, { hue: string; sat: string; light: string }> = {
  terracotta: { hue: '16', sat: '65%', light: '45%' },
  sage: { hue: '140', sat: '30%', light: '40%' },
  ocean: { hue: '210', sat: '60%', light: '45%' },
  plum: { hue: '280', sat: '45%', light: '40%' },
  rose: { hue: '350', sat: '55%', light: '50%' },
  gold: { hue: '40', sat: '70%', light: '45%' },
  charcoal: { hue: '220', sat: '15%', light: '30%' },
  teal: { hue: '175', sat: '50%', light: '38%' },
};

function ThemeColorLoader() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (settings?.themeColor) {
      const color = themeColorMap[settings.themeColor];
      if (color) {
        document.documentElement.style.setProperty('--primary', `${color.hue} ${color.sat} ${color.light}`);
        document.documentElement.style.setProperty('--ring', `${color.hue} ${color.sat} ${color.light}`);
      }
    }
  }, [settings?.themeColor]);

  return null;
}

function App() {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <ThemeColorLoader />
            <Router />
            <FloatingScannerButton />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}

export default App;
