import { createApp } from "./app.js";
import { env } from "./env.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(`golftracker server listening on port ${env.port} (${env.nodeEnv})`);
});
