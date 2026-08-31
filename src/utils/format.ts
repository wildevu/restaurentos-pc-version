export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    const validCurrency = currency && currency.length === 3 ? currency.toUpperCase() : 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: validCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function formatDateTime(date: string | number | Date | null | undefined, timezone?: string): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...(timezone ? { timeZone: timezone } : {})
    };
    return new Intl.DateTimeFormat('en-US', options).format(d);
  } catch {
    return new Date(date).toLocaleString();
  }
}

export function formatTime(date: string | number | Date | null | undefined, timezone?: string): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...(timezone ? { timeZone: timezone } : {})
    };
    return new Intl.DateTimeFormat('en-US', options).format(d);
  } catch {
    return new Date(date).toLocaleTimeString();
  }
}

export function formatDate(date: string | number | Date | null | undefined, timezone?: string): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(timezone ? { timeZone: timezone } : {})
    };
    return new Intl.DateTimeFormat('en-US', options).format(d);
  } catch {
    return new Date(date).toLocaleDateString();
  }
}
