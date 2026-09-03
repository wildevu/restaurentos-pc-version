export function formatCurrency(amount: number, currency: string = 'USD', language: string = 'en'): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const curr = currency ? currency.trim().toUpperCase() : 'USD';
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';

  try {
    // Special handling for DZD, MAD, TND formatting if desired or standard Intl
    if (curr === 'DZD') {
      if (language === 'fr') {
        return `${num.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} DA`;
      }
      return `${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} DA`;
    }
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  } catch {
    if (curr === 'EUR') return `${num.toFixed(2)} €`;
    if (curr === 'DZD') return `${num.toFixed(0)} DA`;
    if (curr === 'GBP') return `£${num.toFixed(2)}`;
    return `$${num.toFixed(2)}`;
  }
}

export function formatDateTime(date: string | number | Date | null | undefined, timezone?: string, language: string = 'en'): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    const locale = language === 'fr' ? 'fr-FR' : 'en-US';
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...(timezone ? { timeZone: timezone } : {})
    };
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch {
    return new Date(date).toLocaleString();
  }
}

export function formatTime(date: string | number | Date | null | undefined, timezone?: string, language: string = 'en'): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    const locale = language === 'fr' ? 'fr-FR' : 'en-US';
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...(timezone ? { timeZone: timezone } : {})
    };
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch {
    return new Date(date).toLocaleTimeString();
  }
}

export function formatDate(date: string | number | Date | null | undefined, timezone?: string, language: string = 'en'): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    const locale = language === 'fr' ? 'fr-FR' : 'en-US';
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(timezone ? { timeZone: timezone } : {})
    };
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch {
    return new Date(date).toLocaleDateString();
  }
}
