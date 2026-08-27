/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_HYDRO_TOKEN_ADDRESS?: string;
  readonly VITE_HYDRO_SETTLEMENT_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
