import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Chain id must match chain/config/local.json — this is the provisional
// local devnet id for Hydro, not an assigned mainnet/testnet id.
const HYDRO_LOCAL_CHAIN_ID = 90731;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: HYDRO_LOCAL_CHAIN_ID,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: HYDRO_LOCAL_CHAIN_ID,
    },
  },
};

export default config;
