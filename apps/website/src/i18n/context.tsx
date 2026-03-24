import { createContext, useContext, useMemo } from 'react';
import type { Dictionary, Lang } from './types';
import { en } from './en';
import { ko } from './ko';

const dicts: Record<Lang, Dictionary> = { en, ko };

interface LangContextValue {
  lang: Lang;
  t: Dictionary;
}

const LangContext = createContext<LangContextValue>({ lang: 'en', t: en });

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: dicts[lang] ?? en }), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
