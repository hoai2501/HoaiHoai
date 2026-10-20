import express from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createBankApp({
  mode = "success",
  webhookUrl = "http://localhost:4001/webhooks/bank",
  webhookSecret = process.env.WEBHOOK_SECRET ?? "local-development-secret",
  callbackDelayMs = 50,
  timeoutDelayMs = 10_000,
  fetchImpl = fetch,
} = {}) {
  const app = express();
  const charges = new Map();

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ service: "bank", status: "ok", mode });
  });

  app.get("/charges/:reference", (request, response) => {
    const charge = charges.get(request.params.reference);
    if (!charge) {
      return response.status(404).json({ error: "Không tìm thấy giao dịch." });
    }

    return response.json(charge);
  });

  app.post("/charges", async (request, response) => {
    const { reference, amount } = request.body ?? {};

    if (
      typeof reference !== "string" ||
      reference.length === 0 ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      return response.status(400).json({
        error: "reference và amount nguyên dương là bắt buộc.",
      });
    }

    const existingCharge = charges.get(reference);
    if (existingCharge) {
      if (existingCharge.amount !== amount) {
        return response.status(409).json({
          error: "reference đã được dùng cho số tiền khác.",
        });
      }

      return response.status(201).json(existingCharge);
    }

    if (mode === "decline") {
      return response.status(402).json({
        error: "Giao dịch bị ngân hàng từ chối.",
      });
    }

    if (mode === "unavailable") {
      return response.status(503).json({
        error: "Dịch vụ ngân hàng hiện không khả dụng.",
      });
    }

    const charge = {
      chargeId: randomUUID(),
      reference,
      amount,
      status: "PROCESSING",
      createdAt: new Date().toISOString(),
    };
    charges.set(reference, charge);
    charge.status = "SUCCESS";

    const completeCharge = async () => {
      const delayMs = mode === "timeout" ? timeoutDelayMs : callbackDelayMs;
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      try {
        const webhookResponse = await fetchImpl(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": webhookSecret,
          },
          body: JSON.stringify({
            reference,
            amount,
            status: "SUCCESS",
          }),
        });

        if (!webhookResponse.ok) {
          console.error(
            `Webhook ${reference} bị từ chối với HTTP ${webhookResponse.status}.`,
          );
          return;
        }

      } catch (error) {
        console.error(`Không gửi được webhook ${reference}:`, error);
      }
    };

    if (mode === "timeout") {
      await new Promise((resolve) => setTimeout(resolve, timeoutDelayMs + 100));
      if (response.destroyed) {
        return;
      }
    } else {
      void completeCharge();
    }

    return response.status(201).json(charge);
  });

  return app;
}
