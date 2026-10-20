import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import net from "node:net";
import { createBankApp } from "../src/bank/app.js";
import { createFeeApp } from "../src/fee/app.js";

const WEBHOOK_SECRET = "test-webhook-secret";
const servers = [];

async function getFreePort() {
  const server = net.createServer();
  server.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function startApp(app, port) {
  const server = app.listen(port, "127.0.0.1");
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function startServices({
  mode = "success",
  bankOptions = {},
  bankTimeoutMs = 1_000,
} = {}) {
  const feePort = await getFreePort();
  const bankPort = await getFreePort();
  const feeBaseUrl = `http://127.0.0.1:${feePort}`;
  const bankBaseUrl = `http://127.0.0.1:${bankPort}`;

  await startApp(
    createFeeApp({
      bankBaseUrl,
      webhookSecret: WEBHOOK_SECRET,
      bankTimeoutMs,
      webhookTimeoutMs: 250,
      students: [{ id: "1", balance: 1_000 }],
    }),
    feePort,
  );
  await startApp(
    createBankApp({
      mode,
      webhookUrl: `${feeBaseUrl}/webhooks/bank`,
      webhookSecret: WEBHOOK_SECRET,
      ...bankOptions,
    }),
    bankPort,
  );

  return { feeBaseUrl, bankBaseUrl };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

test("thanh toán thành công mới trừ công nợ", async () => {
  const { feeBaseUrl, bankBaseUrl } = await startServices();

  const paymentResponse = await fetch(
    `${feeBaseUrl}/students/1/payments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 300 }),
    },
  );
  const payment = await paymentResponse.json();

  assert.equal(paymentResponse.status, 201);
  assert.equal(payment.status, "PAID");
  assert.equal(payment.balance, 700);

  const chargeResponse = await fetch(
    `${bankBaseUrl}/charges/${payment.paymentId}`,
  );
  const charge = await chargeResponse.json();
  assert.equal(chargeResponse.status, 200);
  assert.equal(charge.status, "SUCCESS");
  assert.ok(charge.chargeId);

  const feesResponse = await fetch(`${feeBaseUrl}/students/1/fees`);
  const fees = await feesResponse.json();
  assert.equal(fees.balance, 700);
});

test("từ chối giao dịch khi ngân hàng báo không khả dụng", async () => {
  const { feeBaseUrl } = await startServices({ mode: "unavailable" });

  const response = await fetch(`${feeBaseUrl}/students/1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 300 }),
  });
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.equal(result.status, "FAILED");
  assert.ok(result.paymentId);
});

test("từ chối giao dịch mà không giảm công nợ", async () => {
  const { feeBaseUrl } = await startServices({ mode: "decline" });

  const response = await fetch(`${feeBaseUrl}/students/1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 300 }),
  });
  const result = await response.json();

  assert.equal(response.status, 402);
  assert.equal(result.status, "FAILED");
  assert.ok(result.paymentId);
});

test("cho phép tra cứu khi webhook xác nhận đến sau response timeout", async () => {
  const { feeBaseUrl } = await startServices({
    bankOptions: { callbackDelayMs: 300 },
  });

  const response = await fetch(`${feeBaseUrl}/students/1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 300 }),
  });
  const result = await response.json();

  assert.equal(response.status, 504);
  assert.equal(result.status, "PENDING");

  await new Promise((resolve) => setTimeout(resolve, 100));
  const statusResponse = await fetch(`${feeBaseUrl}/payments/${result.paymentId}`);
  const status = await statusResponse.json();

  assert.equal(statusResponse.status, 200);
  assert.equal(status.status, "PAID");
});

test("timeout giữ giao dịch ở trạng thái chờ đối soát", async () => {
  const { feeBaseUrl } = await startServices({
    mode: "timeout",
    bankTimeoutMs: 50,
    bankOptions: { timeoutDelayMs: 150 },
  });

  const response = await fetch(`${feeBaseUrl}/students/1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 300 }),
  });
  const result = await response.json();

  assert.equal(response.status, 504);
  assert.equal(result.status, "PENDING");
  assert.ok(result.paymentId);
});

test("từ chối amount vượt công nợ", async () => {
  const { feeBaseUrl } = await startServices();

  const response = await fetch(`${feeBaseUrl}/students/1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 1_001 }),
  });
  const result = await response.json();

  assert.equal(response.status, 400);
  assert.equal(result.status, "FAILED");
});

test("trả 503 khi không thể kết nối đến Bank Service", async () => {
  const unavailableBankPort = await getFreePort();
  const feeBaseUrl = await startApp(
    createFeeApp({
      bankBaseUrl: `http://127.0.0.1:${unavailableBankPort}`,
      webhookSecret: WEBHOOK_SECRET,
      bankTimeoutMs: 500,
      students: [{ id: "1", balance: 1_000 }],
    }),
    await getFreePort(),
  );

  const response = await fetch(`${feeBaseUrl}/students/1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 300 }),
  });
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.equal(result.status, "FAILED");

  const feesResponse = await fetch(`${feeBaseUrl}/students/1/fees`);
  const fees = await feesResponse.json();
  assert.equal(fees.balance, 1_000);
});
