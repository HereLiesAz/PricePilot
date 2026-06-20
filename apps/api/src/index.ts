import { refreshRates } from "@pricepilot/intel";
import { loadEnv } from "./env.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildServer({ env });

  // Warm the FX cache in the background, then refresh periodically. Failures are
  // logged but non-fatal — currency normalization falls back to the seed rates.
  refreshRates().catch((err) => app.log.error(err, "Failed to warm FX rates cache"));
  const fxTimer = setInterval(() => {
    refreshRates().catch((err) => app.log.error(err, "Failed to refresh FX rates"));
  }, 12 * 60 * 60_000);
  fxTimer.unref();

  try {
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
