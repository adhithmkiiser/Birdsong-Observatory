import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatTime(timeString: string): string {
  if (timeString.includes('T')) {
    const d = new Date(timeString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  return timeString;
}

export function getIUCNColor(status: string): string {
  switch (status) {
    case 'Least Concern':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400';
    case 'Near Threatened':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400';
    case 'Vulnerable':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400';
    case 'Endangered':
    case 'Critically Endangered':
      return 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400';
    default:
      return 'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400';
  }
}
