import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Wallet, 
  TrendingUp, 
  LogOut,
  ShoppingBag,
  Users,
  Moon,
  Sun,
  History,
  FileText,
  ClipboardList,
  BarChart3,
  Database,
  ArrowLeftRight,
  GripVertical,
  Settings,
  X,
  Globe
} from "lucide-react";
import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";

export function Sidebar() {
  const [location] = useLocation();
  const { data: user } = useUser();
  const { mutate: logout } = useLogout();
  const { theme, setTheme } = useTheme();
  const { t, isRtl, language, setLanguage } = useLanguage();
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const defaultNavItems = useMemo(() => [
    { id: "dashboard", href: "/", label: t.sidebar.dashboard, icon: LayoutDashboard },
    { id: "pos", href: "/pos", label: t.sidebar.pos, icon: ShoppingCart },
    { id: "sales-ledger", href: "/sales-ledger", label: t.sidebar.salesLedger, icon: History },
    { id: "invoices", href: "/invoices", label: t.sidebar.invoices, icon: FileText },
    { id: "custom-orders", href: "/custom-orders", label: t.sidebar.customOrders, icon: ClipboardList },
    { id: "products", href: "/products", label: t.sidebar.products, icon: Package },
    { id: "purchases", href: "/purchases", label: t.sidebar.registerPurchases, icon: ShoppingBag },
    { id: "purchases-ledger", href: "/purchases-ledger", label: t.sidebar.purchasesLedger, icon: TrendingUp },
    { id: "expenses", href: "/expenses", label: t.sidebar.expenses, icon: Wallet },
    { id: "analytics", href: "/analytics", label: t.sidebar.analytics, icon: BarChart3 },
    { id: "backups", href: "/backups", label: t.sidebar.backups, icon: Database },
  ], [t]);

  const ownerManagerItems = useMemo(() => [
    { id: "fund-transfers", href: "/fund-transfers", label: t.sidebar.fundTransfers, icon: ArrowLeftRight },
    { id: "users", href: "/users", label: t.sidebar.users, icon: Users },
    { id: "settings", href: "/settings", label: t.sidebar.settings, icon: Settings },
  ], [t]);

  const [navItems, setNavItems] = useState(defaultNavItems);

  useEffect(() => {
    const savedOrder = localStorage.getItem("sidebarOrder");
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        const orderedItems = orderIds
          .map((id: string) => defaultNavItems.find(item => item.id === id))
          .filter(Boolean);
        const missingItems = defaultNavItems.filter(
          item => !orderIds.includes(item.id)
        );
        setNavItems([...orderedItems, ...missingItems]);
      } catch (e) {
        setNavItems(defaultNavItems);
      }
    } else {
      setNavItems(defaultNavItems);
    }
  }, [defaultNavItems]);

  const saveOrder = (items: typeof defaultNavItems) => {
    const orderIds = items.map(item => item.id);
    localStorage.setItem("sidebarOrder", JSON.stringify(orderIds));
    setNavItems(items);
  };

  const handleDragStart = (id: string) => {
    setDraggedItem(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;

    const newItems = [...navItems];
    const draggedIndex = newItems.findIndex(item => item.id === draggedItem);
    const targetIndex = newItems.findIndex(item => item.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newItems.splice(draggedIndex, 1);
      newItems.splice(targetIndex, 0, removed);
      saveOrder(newItems);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    const newItems = [...navItems];
    const index = newItems.findIndex(item => item.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newItems.length) return;
    
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    saveOrder(newItems);
  };

  return (
    <aside className={`fixed ${isRtl ? 'right-0' : 'left-0'} top-0 h-screen w-64 bg-card ${isRtl ? 'border-l' : 'border-r'} border-border/50 flex flex-col z-50 transition-all duration-300`}>
      {/* Header */}
      <div className="p-6 border-b border-border/50 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
            <span className="text-white font-bold text-xl">ف</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-base text-foreground tracking-tight truncate leading-tight">{t.auth.shopName}</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{t.sidebar.potteryAndCeramic}</p>
          </div>
          {(user?.role === "owner" || user?.role === "manager") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setIsOrderDialogOpen(true)}
              title={t.sidebar.reorderMenu}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item, index) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer group font-medium slide-in-right",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                <item.icon className={cn("w-5 h-5 transition-transform duration-200 group-hover:scale-110", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                <span>{item.label}</span>
                {isActive && (
                  <div className={`${isRtl ? 'mr-auto' : 'ml-auto'} w-1.5 h-1.5 rounded-full bg-primary badge-pop`} />
                )}
              </div>
            </Link>
          );
        })}

        {/* Owner/Manager Only Items */}
        {(user?.role === "owner" || user?.role === "manager") && (
          <>
            {ownerManagerItems.map((item, index) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer group font-medium slide-in-right",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    style={{ animationDelay: `${(navItems.length + index) * 0.03}s` }}
                  >
                    <item.icon className={cn("w-5 h-5 transition-transform duration-200 group-hover:scale-110", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                    <span>{item.label}</span>
                    {isActive && (
                      <div className={`${isRtl ? 'mr-auto' : 'ml-auto'} w-1.5 h-1.5 rounded-full bg-primary badge-pop`} />
                    )}
                  </div>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-border/50 bg-muted/20 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {user?.username?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{user?.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className="shrink-0"
            >
              <Globe className="h-4 w-4" />
              <span className="text-[10px] font-bold">{language === "ar" ? "EN" : "عر"}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="shrink-0"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full gap-2 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4" />
          <span>{t.auth.logout}</span>
        </Button>
      </div>

      {/* Order Dialog */}
      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent className="sm:max-w-md" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t.sidebar.reorderSidebar}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {navItems.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-all",
                  draggedItem === item.id && "opacity-50 border-primary"
                )}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                <item.icon className="h-5 w-5 text-primary" />
                <span className="flex-1 font-medium">{item.label}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveItem(item.id, 'up')}
                    disabled={index === 0}
                  >
                    <span className="text-lg">↑</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveItem(item.id, 'down')}
                    disabled={index === navItems.length - 1}
                  >
                    <span className="text-lg">↓</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                saveOrder(defaultNavItems);
              }}
            >
              {t.common.reset}
            </Button>
            <Button
              className="flex-1"
              onClick={() => setIsOrderDialogOpen(false)}
            >
              {t.common.done}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
