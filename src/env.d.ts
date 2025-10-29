interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  // add other env vars you use, e.g. VITE_API_URL
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
