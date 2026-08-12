/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

interface ImportMetaEnv {
  readonly MRT_ENVIRONMENT?: "development" | "production";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
