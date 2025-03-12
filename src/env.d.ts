/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TAWK_PROPERTY_ID: string
  readonly VITE_TAWK_WIDGET_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    Tawk_API?: any;
    Tawk_LoadStart?: Date;
  }
} 