/** Explorer runtime config, overridable via .env (VITE_* variables). */
export const config = {
  rpcUrl: import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545",
  hydroTokenAddress: (import.meta.env.VITE_HYDRO_TOKEN_ADDRESS || "") as `0x${string}` | "",
};
