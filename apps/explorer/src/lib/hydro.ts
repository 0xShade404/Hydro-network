import { createHydroClient } from "@hydro/sdk";
import { config } from "./config";

/** Shared read-only client used by the whole explorer. */
export const client = createHydroClient({ rpcUrl: config.rpcUrl });
