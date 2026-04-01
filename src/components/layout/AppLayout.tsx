import { ReactNode, useRef, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { useUser } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useUser();
  const [location] = useLocation();
  const [animKey, setAnimKey] = useState(0);
  const prevLocation = useRef(location);
  const { dir, isRtl } = useLanguage();

  useEffect(() => {
    if (prevLocation.current !== location) {
      prevLocation.current = location;
      setAnimKey(k => k + 1);
    }
  }, [location]);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin opacity-50" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="min-h-screen bg-background flex" dir={dir}>
      <Sidebar />
      <main className={`flex-1 ${isRtl ? 'mr-64' : 'ml-64'} transition-all duration-300 p-8`}>
        <div key={animKey} className="max-w-7xl mx-auto space-y-8 fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
