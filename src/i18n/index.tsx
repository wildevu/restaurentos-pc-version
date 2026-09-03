import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { en, Translations } from './en';
import { fr } from './fr';
import { formatCurrency as formatCurrencyUtil, formatDate as formatDateUtil, formatTime as formatTimeUtil, formatDateTime as formatDateTimeUtil } from '../utils/format';

export type TranslateFunction = {
  (key: string, fallbackOrParams?: string | Record<string, any>, params?: Record<string, any>): string;
} & Translations;

interface I18nContextType {
  language: 'en' | 'fr';
  currency: string;
  timezone: string;
  t: TranslateFunction;
  setLanguage: (lang: 'en' | 'fr') => void;
  setCurrency: (currency: string) => void;
  setTimezone: (timezone: string) => void;
  formatCurrency: (amount: number, overrideCurrency?: string) => string;
  formatDateTime: (date: string | number | Date | null | undefined) => string;
  formatTime: (date: string | number | Date | null | undefined) => string;
  formatDate: (date: string | number | Date | null | undefined) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function createTranslateFunction(dict: Translations): TranslateFunction {
  const fn = function(key: string, fallbackOrParams?: string | Record<string, any>, params?: Record<string, any>): string {
    if (!key) return '';
    let fallback: string | undefined;
    let actualParams: Record<string, any> | undefined;

    if (typeof fallbackOrParams === 'string') {
      fallback = fallbackOrParams;
      actualParams = params;
    } else if (fallbackOrParams && typeof fallbackOrParams === 'object') {
      actualParams = fallbackOrParams;
    }

    const parts = key.split('.');
    let current: any = dict;
    let found = true;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        found = false;
        break;
      }
    }

    let result: string;
    if (found && typeof current === 'string') {
      result = current;
    } else {
      // Fallback to English dictionary
      let enCurrent: any = en;
      let enFound = true;
      for (const enPart of parts) {
        if (enCurrent && typeof enCurrent === 'object' && enPart in enCurrent) {
          enCurrent = enCurrent[enPart];
        } else {
          enFound = false;
          break;
        }
      }
      if (enFound && typeof enCurrent === 'string') {
        result = enCurrent;
      } else {
        result = fallback || key;
      }
    }

    if (actualParams) {
      for (const [k, v] of Object.entries(actualParams)) {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }

    return result;
  };

  // Attach all top-level translation objects to the function
  Object.assign(fn, dict);

  return fn as TranslateFunction;
}

export const I18nProvider: React.FC<{
  restaurant?: { language?: string; currency?: string; timezone?: string } | null;
  initialLanguage?: string;
  initialCurrency?: string;
  initialTimezone?: string;
  children: React.ReactNode;
}> = ({
  restaurant,
  initialLanguage = 'en',
  initialCurrency = 'USD',
  initialTimezone = 'UTC',
  children
}) => {
  const effectiveLang = (restaurant?.language || initialLanguage || 'en') as 'en' | 'fr';
  const effectiveCurr = restaurant?.currency || initialCurrency || 'USD';
  const effectiveTz = restaurant?.timezone || initialTimezone || 'UTC';

  const [language, setLanguageState] = useState<'en' | 'fr'>(effectiveLang === 'fr' ? 'fr' : 'en');
  const [currency, setCurrencyState] = useState<string>(effectiveCurr);
  const [timezone, setTimezoneState] = useState<string>(effectiveTz);

  // Sync state whenever restaurant configuration updates from server
  useEffect(() => {
    const nextLang = restaurant?.language || initialLanguage;
    if (nextLang && (nextLang === 'en' || nextLang === 'fr')) {
      setLanguageState(nextLang as 'en' | 'fr');
    }
  }, [restaurant?.language, initialLanguage]);

  useEffect(() => {
    const nextCurr = restaurant?.currency || initialCurrency;
    if (nextCurr) {
      setCurrencyState(nextCurr);
    }
  }, [restaurant?.currency, initialCurrency]);

  useEffect(() => {
    const nextTz = restaurant?.timezone || initialTimezone;
    if (nextTz) {
      setTimezoneState(nextTz);
    }
  }, [restaurant?.timezone, initialTimezone]);

  const setLanguage = (lang: 'en' | 'fr') => {
    setLanguageState(lang);
  };

  const setCurrency = (curr: string) => {
    const cleanCurr = curr.trim().toUpperCase();
    setCurrencyState(cleanCurr);
  };

  const setTimezone = (tz: string) => {
    setTimezoneState(tz);
  };

  const t = useMemo(() => {
    const dict = language === 'fr' ? fr : en;
    return createTranslateFunction(dict);
  }, [language]);

  const formatCurrency = (amount: number, overrideCurrency?: string) => {
    return formatCurrencyUtil(amount, overrideCurrency || currency, language);
  };

  const formatDateTime = (date: string | number | Date | null | undefined) => {
    return formatDateTimeUtil(date, timezone, language);
  };

  const formatTime = (date: string | number | Date | null | undefined) => {
    return formatTimeUtil(date, timezone, language);
  };

  const formatDate = (date: string | number | Date | null | undefined) => {
    return formatDateUtil(date, timezone, language);
  };

  const value = {
    language,
    currency,
    timezone,
    t,
    setLanguage,
    setCurrency,
    setTimezone,
    formatCurrency,
    formatDateTime,
    formatTime,
    formatDate,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

const defaultT = createTranslateFunction(en);

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    // Return fallback if rendered outside provider
    return {
      language: 'en',
      currency: 'USD',
      timezone: 'UTC',
      t: defaultT,
      setLanguage: () => {},
      setCurrency: () => {},
      setTimezone: () => {},
      formatCurrency: (amt, curr) => formatCurrencyUtil(amt, curr || 'USD', 'en'),
      formatDateTime: (d) => formatDateTimeUtil(d, 'UTC', 'en'),
      formatTime: (d) => formatTimeUtil(d, 'UTC', 'en'),
      formatDate: (d) => formatDateUtil(d, 'UTC', 'en'),
    };
  }
  return context;
}
