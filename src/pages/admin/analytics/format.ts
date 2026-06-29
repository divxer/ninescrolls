import type { DateRange } from './types';

export function normalizePath(p: string): string {
  return p !== '/' && p.endsWith('/') ? p.slice(0, -1) : p;
}

export function getDateBounds(range: DateRange, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  switch (range) {
    case 'today':
      return { start: todayStart, end: todayEnd };
    case 'yesterday': {
      const ydayStart = new Date(todayStart.getTime() - 86400000);
      return { start: ydayStart, end: todayStart };
    }
    case 'last7':
      return { start: new Date(todayStart.getTime() - 7 * 86400000), end: todayEnd };
    case 'last30':
      return { start: new Date(todayStart.getTime() - 30 * 86400000), end: todayEnd };
    case 'custom': {
      const s = customStart ? new Date(customStart) : new Date(todayStart.getTime() - 7 * 86400000);
      const e = customEnd ? new Date(new Date(customEnd).getTime() + 86400000) : todayEnd;
      return { start: s, end: e };
    }
    case 'all':
      return { start: new Date(0), end: todayEnd };
  }
}

export function tierRank(tier: string | null): number {
  if (tier === 'A') return 3;
  if (tier === 'B') return 2;
  if (tier === 'C') return 1;
  return 0;
}

export function tierColor(tier: string | null): string {
  switch (tier) {
    case 'A': return '#2e7d32';
    case 'B': return '#f57c00';
    case 'C': return '#9e9e9e';
    default: return '#90caf9';
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (mins > 0) return `${hours}h ${mins}m`;
  return `${hours}h`;
}

export function engagementLevel(score: number): 'High' | 'Medium' | 'Low' | null {
  if (score >= 0.4) return 'High';
  if (score >= 0.15) return 'Medium';
  if (score > 0) return 'Low';
  return null;
}

export function engagementRank(score: number): number {
  if (score >= 0.4) return 3;
  if (score >= 0.15) return 2;
  if (score > 0) return 1;
  return 0;
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function isPrivateIP(ip: string): boolean {
  // IPv4 private/reserved ranges
  if (/^10\./.test(ip)) return true;                            // 10.0.0.0/8
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;    // 172.16.0.0/12 (Docker etc.)
  if (/^192\.168\./.test(ip)) return true;                      // 192.168.0.0/16
  if (/^127\./.test(ip)) return true;                           // 127.0.0.0/8 (loopback)
  if (/^169\.254\./.test(ip)) return true;                      // 169.254.0.0/16 (link-local)
  if (/^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./.test(ip)) return true; // 100.64.0.0/10 (CGNAT)
  if (ip === '0.0.0.0' || ip === '::1' || ip === '::') return true;
  return false;
}

export function maskIP(ip: string): string {
  if (ip.includes(':')) {
    // IPv6: show first 2 groups
    const parts = ip.split(':');
    return parts.slice(0, 2).join(':') + ':***';
  }
  // IPv4: mask 3rd octet
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.${parts[3]}`;
  return ip;
}
