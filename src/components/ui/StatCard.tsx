import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  variant?: "default" | "primary" | "secondary" | "accent";
}

export function StatCard({ 
  title, 
  value, 
  icon, 
  subtitle,
  trend, 
  trendUp, 
  className,
  variant = "default"
}: StatCardProps) {
  
  const variants = {
    default: "bg-card border-border/50",
    primary: "bg-primary text-primary-foreground border-primary",
    secondary: "bg-secondary text-secondary-foreground border-secondary",
    accent: "bg-accent text-accent-foreground border-accent",
  };

  const iconVariants = {
    default: "bg-primary/10 text-primary",
    primary: "bg-white/20 text-white",
    secondary: "bg-white/50 text-secondary-foreground",
    accent: "bg-white/20 text-accent-foreground",
  };

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden", variants[variant], className)}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className={cn("text-sm font-medium", variant === 'default' ? "text-muted-foreground" : "text-white/80")}>
              {title}
            </p>
            <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
            {subtitle && (
              <p className={cn("text-xs", variant === 'default' ? "text-muted-foreground" : "text-white/60")}>
                {subtitle}
              </p>
            )}
          </div>
          <div className={cn("p-2.5 rounded-xl", iconVariants[variant])}>
            {icon}
          </div>
        </div>
        
        {trend && (
          <div className="mt-4 flex items-center text-xs">
            <span className={cn(
              "font-medium px-1.5 py-0.5 rounded", 
              trendUp ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            )}>
              {trend}
            </span>
            <span className={cn("mr-2", variant === 'default' ? "text-muted-foreground" : "text-white/60")}>
              مقارنة بالشهر الماضي
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
