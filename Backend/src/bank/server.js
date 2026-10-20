import { createBankApp } from "./app.js";

const port = Number.parseInt(process.env.BANK_PORT ?? "4002", 10);
const mode = process.env.BANK_MODE ?? "success";

if (!["success", "decline", "unavailable", "timeout"].includes(mode)) {
  throw new Error(
    "BANK_MODE phải là success, decline, unavailable hoặc timeout.",
  );
}

const app = createBankApp({
  mode,
  webhookUrl:
    process.env.FEE_WEBHOOK_URL ?? "http://localhost:4001/webhooks/bank",
  webhookSecret: process.env.WEBHOOK_SECRET ?? "local-development-secret",
  callbackDelayMs: Number.parseInt(
    process.env.BANK_CALLBACK_DELAY_MS ?? "50",
    10,
  ),
  timeoutDelayMs: Number.parseInt(
    process.env.BANK_TIMEOUT_DELAY_MS ?? "10000",
    10,
  ),
});

app.listen(port, () => {
  console.log(
    `Bank Service đang chạy tại http://localhost:${port} (mode: ${mode})`,
  );
});
