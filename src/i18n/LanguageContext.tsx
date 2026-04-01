import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import ar from "./ar";
import en from "./en";
import type { Translations } from "./ar";

type LanguageContextType = {
  language: "ar" | "en";
  setLanguage: (lang: "ar" | "en") => void;
  t: Translations;
  dir: "rtl" | "ltr";
  isRtl: boolean;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "ar",
  setLanguage: () => {},
  t: ar,
  dir: "rtl",
  isRtl: true,
});

const translations: Record<string, Translations> = { ar, en };

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<"ar" | "en">(() => {
    const saved = localStorage.getItem("app-language");
    return (saved === "en" ? "en" : "ar");
  });

  const t = translations[language];

  const setLanguage = (lang: "ar" | "en") => {
    setLanguageState(lang);
    localStorage.setItem("app-language", lang);
  };

  useEffect(() => {
    document.documentElement.lang = t.lang;
    document.documentElement.dir = t.dir;
  }, [language, t.lang, t.dir]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir: t.dir, isRtl: t.dir === "rtl" }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
