import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';

type ThemePreference = 'light' | 'dark' | 'auto';
type EffectiveTheme = 'light' | 'dark';

interface SunTimes {
  sunrise: string;
  sunset: string;
  date: string;
  lat: number;
  lng: number;
}

interface ThemeContextType {
  preference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'theme-preference';
const SUN_CACHE_KEY = 'sun-times-cache';
const FALLBACK_LAT = 32.7157;
const FALLBACK_LNG = -117.1611;

function isNightByTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 7;
}

function isNightBySunTimes(sunTimes: SunTimes): boolean {
  const now = new Date();
  const sunrise = new Date(sunTimes.sunrise);
  const sunset = new Date(sunTimes.sunset);
  return now >= sunset || now <= sunrise;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getCachedSunTimes(): SunTimes | null {
  try {
    const cached = localStorage.getItem(SUN_CACHE_KEY);
    if (!cached) return null;
    const parsed: SunTimes = JSON.parse(cached);
    if (parsed.date === getTodayStr()) return parsed;
    return null;
  } catch {
    return null;
  }
}

function cacheSunTimes(sunTimes: SunTimes): void {
  try {
    localStorage.setItem(SUN_CACHE_KEY, JSON.stringify(sunTimes));
  } catch {
    // localStorage unavailable
  }
}

async function fetchSunTimes(lat: number, lng: number): Promise<SunTimes | null> {
  try {
    const res = await fetch(
      `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`
    );
    const data = await res.json();
    if (data.status === 'OK') {
      const sunTimes: SunTimes = {
        sunrise: data.results.sunrise,
        sunset: data.results.sunset,
        date: getTodayStr(),
        lat,
        lng,
      };
      cacheSunTimes(sunTimes);
      return sunTimes;
    }
    return null;
  } catch {
    return null;
  }
}

function getUserPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: FALLBACK_LAT, lng: FALLBACK_LNG });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: FALLBACK_LAT, lng: FALLBACK_LNG }),
      { timeout: 5000 }
    );
  });
}

function getStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  } catch {
    // localStorage unavailable
  }
  return 'auto';
}

function applyTheme(theme: EffectiveTheme): void {
  // Apply only to .admin-root — never to <html> to avoid leaking to public pages
  const adminRoot = document.querySelector('.admin-root');
  if (adminRoot) {
    adminRoot.setAttribute('data-theme', theme);
  }
}

function removeTheme(): void {
  const adminRoot = document.querySelector('.admin-root');
  if (adminRoot) {
    adminRoot.removeAttribute('data-theme');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(getStoredPreference);
  const [autoIsDark, setAutoIsDark] = useState<boolean>(isNightByTime);

  // Resolve auto mode: fetch sun times and check periodically
  useEffect(() => {
    if (preference !== 'auto') return;

    let cancelled = false;

    const updateAutoTheme = async () => {
      // Try cached first
      const cached = getCachedSunTimes();
      if (cached) {
        if (!cancelled) setAutoIsDark(isNightBySunTimes(cached));
        return;
      }

      // Fetch fresh sun times
      const pos = await getUserPosition();
      const sunTimes = await fetchSunTimes(pos.lat, pos.lng);
      if (!cancelled) {
        setAutoIsDark(sunTimes ? isNightBySunTimes(sunTimes) : isNightByTime());
      }
    };

    updateAutoTheme();

    // Re-check every minute
    const interval = setInterval(() => {
      const cached = getCachedSunTimes();
      if (cached) {
        setAutoIsDark(isNightBySunTimes(cached));
      } else {
        setAutoIsDark(isNightByTime());
      }
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [preference]);

  // Compute effective theme
  const effectiveTheme: EffectiveTheme =
    preference === 'auto' ? (autoIsDark ? 'dark' : 'light') : preference;

  // Apply to DOM, clean up on unmount (leaving admin)
  useEffect(() => {
    applyTheme(effectiveTheme);
    return () => removeTheme();
  }, [effectiveTheme]);

  // Persist preference
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // localStorage unavailable
    }
  }, [preference]);

  const toggleTheme = useCallback(() => {
    setPreference((prev) => {
      if (prev === 'auto') return 'dark';
      if (prev === 'dark') return 'light';
      return 'auto';
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, effectiveTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
