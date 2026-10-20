import express from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";

const DEFAULT_STUDENTS = [
  { id: "1", balance: 50_000_000 },
  { id: "2", balance: 3_200_000 },
];

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isConnectionRefused(error) {
  const pending = [error];
  const visited = new Set();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);
    if (current.code === "ECONNREFUSED" || current.code === "ENOTFOUND") {
      return true;
    }

    if (current.cause) {
      pending.push(current.cause);
    }
    if (Array.isArray(current.errors)) {
      pending.push(...current.errors);
    }
  }

  return false;
}

export function createFeeApp({
  bankBaseUrl = "http://localhost:4002",
  webhookSecret = process.env.WEBHOOK_SECRET ?? "local-development-secret",
  bankTimeoutMs = 3_000,
  webhookTimeoutMs = 5_000,
  students = DEFAULT_STUDENTS,
  fetchImpl = fetch,
} = {}) {
  const app = express();
  const studentBalances = new Map(
    students.map(({ id, balance }) => [String(id), balance]),
  );
  const payments = new Map();
  const webhookWaiters = new Map();

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ service: "fee", status: "ok" });
  });

  app.get("/students/:id/fees", (request, response) => {
    const studentId = request.params.id;
    const balance = studentBalances.get(studentId);

    if (balance === undefined) {
      return response.status(404).json({ error: "Không tìm thấy sinh viên." });
    }

    return response.json({
      studentId,
      balance,
      currency: "VND",
    });
  });

  app.get("/payments/:paymentId", (request, response) => {
    const payment = payments.get(request.params.paymentId);
    if (!payment) {
      return response.status(404).json({ error: "Không tìm thấy giao dịch." });
    }

    return response.json(payment);
  });

  app.post("/students/:id/payments", async (request, response) => {
    const studentId = request.params.id;
    const balance = studentBalances.get(studentId);

    if (balance === undefined) {
      return response.status(404).json({
        error: "Không tìm thấy sinh viên.",
        status: "FAILED",
      });
    }

    const { amount } = request.body ?? {};
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return response.status(400).json({
        error: "amount phải là số nguyên dương (VND).",
        status: "FAILED",
      });
    }

    const reservedAmount = [...payments.values()]
      .filter(
        (payment) =>
          payment.studentId === studentId && payment.status === "PENDING",
      )
      .reduce((total, payment) => total + payment.amount, 0);

    if (amount > balance - reservedAmount) {
      return response.status(400).json({
        error: "Số tiền thanh toán vượt quá công nợ còn lại.",
        status: "FAILED",
      });
    }

    const paymentId = randomUUID();
    const payment = {
      paymentId,
      reference: paymentId,
      studentId,
      amount,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    payments.set(paymentId, payment);

    let resolveWebhook;
    const webhookResult = new Promise((resolve) => {
      resolveWebhook = resolve;
    });
    webhookWaiters.set(paymentId, resolveWebhook);

    const abortController = new AbortController();
    const bankTimeout = setTimeout(
      () => abortController.abort(),
      bankTimeoutMs,
    );

    try {
      const bankResponse = await fetchImpl(`${bankBaseUrl}/charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: paymentId, amount }),
        signal: abortController.signal,
      });
      clearTimeout(bankTimeout);

      if (bankResponse.status === 402 || bankResponse.status === 503) {
        const bankError = await bankResponse.json().catch(() => ({}));
        payment.status = "FAILED";
        payment.error =
          bankError.error ??
          (bankResponse.status === 402
            ? "Ngân hàng từ chối giao dịch."
            : "Ngân hàng tạm thời không khả dụng.");
        return response.status(bankResponse.status).json({
          error: payment.error,
          paymentId,
          status: payment.status,
        });
      }

      if (!bankResponse.ok) {
        payment.status = "FAILED";
        payment.error = `Ngân hàng trả về HTTP ${bankResponse.status}.`;
        return response.status(502).json({
          error: payment.error,
          paymentId,
          status: payment.status,
        });
      }

      let webhookTimer;
      const webhookTimeout = new Promise((resolve) => {
        webhookTimer = setTimeout(() => resolve(null), webhookTimeoutMs);
      });
      const webhook = await Promise.race([webhookResult, webhookTimeout]);
      clearTimeout(webhookTimer);

      if (!webhook) {
        return response.status(504).json({
          error: "Chưa nhận được xác nhận từ ngân hàng; cần đối soát giao dịch.",
          paymentId,
          status: payment.status,
        });
      }

      if (payment.status === "PAID") {
        return response.status(201).json({
          paymentId,
          studentId,
          amount,
          status: payment.status,
          balance: studentBalances.get(studentId),
        });
      }

      return response.status(402).json({
        error: payment.error ?? "Ngân hàng từ chối giao dịch.",
        paymentId,
        status: payment.status,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        return response.status(504).json({
          error: "Ngân hàng không phản hồi trong thời gian chờ; cần đối soát giao dịch.",
          paymentId,
          status: payment.status,
        });
      }

      if (isConnectionRefused(error)) {
        payment.status = "FAILED";
        payment.error = "Không thể kết nối đến ngân hàng.";
        return response.status(503).json({
          error: payment.error,
          paymentId,
          status: payment.status,
        });
      }

      console.error("Không thể hoàn tất yêu cầu tới Bank Service:", error);
      return response.status(504).json({
        error: "Không nhận được kết quả từ ngân hàng; cần đối soát giao dịch.",
        paymentId,
        status: payment.status,
      });
    } finally {
      clearTimeout(bankTimeout);
      webhookWaiters.delete(paymentId);
    }
  });

  app.post("/webhooks/bank", (request, response) => {
    const suppliedSecret = request.get("x-webhook-secret") ?? "";
    if (!secureEqual(suppliedSecret, webhookSecret)) {
      return response.status(401).json({ error: "Webhook không hợp lệ." });
    }

    const { reference, amount, status } = request.body ?? {};
    const payment = payments.get(reference);

    if (!payment) {
      return response.status(404).json({ error: "Không tìm thấy giao dịch." });
    }

    if (
      !Number.isSafeInteger(amount) ||
      amount !== payment.amount ||
      !["SUCCESS", "FAILED"].includes(status)
    ) {
      return response.status(400).json({ error: "Dữ liệu webhook không hợp lệ." });
    }

    if (payment.status === "PENDING") {
      if (status === "SUCCESS") {
        const currentBalance = studentBalances.get(payment.studentId);
        if (payment.amount > currentBalance) {
          return response.status(409).json({
            error: "Công nợ đã thay đổi; cần đối soát giao dịch.",
          });
        }

        studentBalances.set(payment.studentId, currentBalance - payment.amount);
        payment.status = "PAID";
      } else {
        payment.status = "FAILED";
        payment.error = "Ngân hàng từ chối giao dịch.";
      }
    }

    webhookWaiters.get(payment.paymentId)?.({
      status: payment.status,
      error: payment.error,
    });

    return response.json({ received: true, paymentId: payment.paymentId });
  });

  return app;
}
