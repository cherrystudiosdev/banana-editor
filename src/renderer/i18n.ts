import { createContext, useContext } from 'react';
import en from './locales/en.json';
import tr from './locales/tr.json';
export type TextKey = keyof typeof en;
export const LanguageContext = createContext<'en' | 'tr'>('tr');
export function useText() { const language = useContext(LanguageContext); return (key: TextKey) => ((language === 'tr' ? tr : en) as Record<string, string>)[key] ?? en[key]; }
