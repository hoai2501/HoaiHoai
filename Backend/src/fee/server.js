import { createFeeApp } from "./app.js";

const port = Number.parseInt(process.env.FEE_PORT ?? "4001", 10);
const app = createFeeApp({
  bankBaseUrl: process.env.BANK_URL ?? "http://localhost:4002",
  webhookSecret: process.env.WEBHOOK_SECRET ?? "local-development-secret",
  bankTimeoutMs: Number.parseInt(process.env.BANK_TIMEOUT_MS ?? "3000", 10),
  webhookTimeoutMs: Number.parseInt(
    process.env.WEBHOOK_TIMEOUT_MS ?? "5000",
    10,
  ),
});

app.listen(port, () => {
  console.log(`Fee Service đang chạy tại http://localhost:${port}`);
});
