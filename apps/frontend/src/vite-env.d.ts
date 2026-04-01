/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

interface ImportMetaEnv {
  readonly MRT_ENVIRONMENT?: "development" | "production";
  readonly YAMCS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
