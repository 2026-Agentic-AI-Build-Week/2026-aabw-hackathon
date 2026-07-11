import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { OrderStatus, PrismaClient } from "@prisma/client";
import { AuthError, AuthService } from "../auth/auth-service.js";
import type { AuthServiceDependencies } from "../auth/auth-service.js";
import { MenuItemService } from "../menu-items/menu-item-service.js";
import { OrderInputError, parseQuoteInput } from "../orders/order-input.js";
import { OrderError, OrderService } from "../orders/order-service.js";
import { attachChatSocketServer, emitPaymentConfirmation } from "../realtime/socket-server.js";
import type { ChatHandler } from "../realtime/chat-handler.js";
import { PaymentConfirmationError, type PaymentConfirmationService } from "../payments/payment-confirmation-service.js";
import type { AiResponseEvent } from "../realtime/chat-events.js";

type RequestOptions = { method?: string; body?: unknown; headers?: Record<string, string> };
type Application = { listen(port: number, host?: string): Promise<{ close(): Promise<void>; request(path: string, options?: RequestOptions): Promise<Response> }> };
type ApplicationOptions = {
  chatHandler?: ChatHandler;
  paymentCallbackSecret?: string;
  payments?: Pick<PaymentConfirmationService, "confirm">;
  notifyPaymentMessage?: (sessionId: string, message: AiResponseEvent["message"]) => void;
};

export function createAuthApplication(dependencies: AuthServiceDependencies, prisma?: PrismaClient, options: ApplicationOptions = {}): Application {
  const auth = new AuthService(dependencies);
  const orders = prisma ? new OrderService(prisma) : undefined;
  const menuItems = prisma ? new MenuItemService(prisma) : undefined;
  return {
    async listen(port, host = "127.0.0.1") {
      let io: ReturnType<typeof attachChatSocketServer> | undefined;
      const notifyPaymentMessage = options.notifyPaymentMessage ?? ((sessionId: string, message: AiResponseEvent["message"]) => { if (io) emitPaymentConfirmation(io, sessionId, message); });
      const server = createServer((request, response) => void handle(request, response, auth, orders, menuItems, options.payments, options.paymentCallbackSecret, notifyPaymentMessage));
      io = options.chatHandler ? attachChatSocketServer(server, auth, options.chatHandler) : undefined;
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve();
        });
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Server did not bind to a TCP port.");
      return { close: async () => { await io?.close(); await close(server); }, request: (path, options = {}) => fetch(`http://127.0.0.1:${address.port}${path}`, { method: options.method ?? "GET", headers: { ...(options.body === undefined ? {} : { "content-type": "application/json" }), ...options.headers }, body: options.body === undefined ? undefined : JSON.stringify(options.body) }) };
    },
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, auth: AuthService, orders?: OrderService, menuItems?: MenuItemService, payments?: Pick<PaymentConfirmationService, "confirm">, paymentCallbackSecret?: string, notifyPaymentMessage?: ApplicationOptions["notifyPaymentMessage"]): Promise<void> {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const path = requestUrl.pathname;
    if (request.method === "POST" && path === "/payments/confirm") {
      if (!payments || !paymentCallbackSecret) return send(response, 404, { error: { code: "NOT_FOUND", message: "Route not found." } });
      if (request.headers["x-payment-callback-secret"] !== paymentCallbackSecret) return send(response, 401, { error: { code: "UNAUTHORIZED", message: "Payment callback authentication failed." } });
      const body = await readJson(request);
      validateString(body.orderId, "orderId");
      const result = await payments.confirm(body.orderId);
      if (result.confirmed && result.sessionId && result.message) notifyPaymentMessage?.(result.sessionId, result.message);
      return send(response, 200, { order_id: body.orderId, confirmed: result.confirmed });
    }
    if (request.method === "POST" && path === "/api/auth/login") { const body = await readJson(request); validateString(body.email, "email"); validateString(body.password, "password"); validateString(body.device_id, "device_id"); return send(response, 200, await auth.login(body.email, body.password, body.device_id)); }
    if (request.method === "POST" && path === "/api/auth/refresh") { const body = await readJson(request); validateString(body.refresh_token, "refresh_token"); validateString(body.device_id, "device_id"); return send(response, 200, await auth.refresh(body.refresh_token, body.device_id)); }
    const principal = authenticate(request, auth);
    if (request.method === "POST" && path === "/api/auth/logout") { await auth.logout(principal); return send(response, 204); }
    if (request.method === "GET" && path === "/api/auth/me") return send(response, 200, await auth.me(principal));
    if (request.method === "GET" && path === "/api/menu-items") {
      if (!menuItems) return send(response, 404, { error: { code: "NOT_FOUND", message: "Route not found." } });
      return send(response, 200, await menuItems.findByIds(readMenuItemIds(requestUrl)));
    }
    if (!orders) return send(response, 404, { error: { code: "NOT_FOUND", message: "Route not found." } });
    if (request.method === "POST" && path === "/api/order-quotes") return send(response, 201, await orders.createQuote(principal.userId, parseQuoteInput(await readJson(request))));
    if (request.method === "POST" && path === "/api/orders") {
      const body = await readJson(request); validateString(body.quote_id, "quote_id"); validateString(body.confirmation_token, "confirmation_token");
      const key = request.headers["idempotency-key"]; validateString(key, "Idempotency-Key");
      const result = await orders.createOrder(principal.userId, body.quote_id, body.confirmation_token, key);
      return send(response, result.created ? 201 : 200, result.order);
    }
    if (request.method === "GET" && path === "/api/orders") return send(response, 200, await orders.listOrders(principal.userId, readPositiveQuery(requestUrl, "page", 1, 1, Number.MAX_SAFE_INTEGER), readPositiveQuery(requestUrl, "page_size", 20, 1, 100), parseStatus(requestUrl.searchParams.get("status"))));
    const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
    const deliveryMatch = path.match(/^\/api\/orders\/([^/]+)\/delivery$/);
    if (request.method === "GET" && orderMatch) return send(response, 200, await orders.getOrder(principal.userId, orderMatch[1]));
    if (request.method === "PATCH" && deliveryMatch) { const quoteInput = parseQuoteInput({ session_id: "delivery-update", items: [{ menu_item_id: "delivery-update", quantity: 1 }], delivery: (await readJson(request)).delivery }); return send(response, 200, await orders.updateDelivery(principal.userId, deliveryMatch[1], quoteInput.delivery)); }
    if (request.method === "DELETE" && orderMatch) { const body = await readOptionalJson(request); return send(response, 200, await orders.cancelOrder(principal.userId, orderMatch[1], typeof body.reason === "string" ? body.reason : undefined)); }
    return send(response, 404, { error: { code: "NOT_FOUND", message: "Route not found." } });
  } catch (error) {
    if (error instanceof OrderError) return send(response, error.statusCode, { error: { code: error.code, message: error.message } });
    if (error instanceof PaymentConfirmationError) return send(response, error.statusCode, { error: { code: error.code, message: error.message } });
    if (error instanceof AuthError) return send(response, error.statusCode, { error: { code: error.code, message: error.message } });
    if (error instanceof ValidationError || error instanceof OrderInputError) return send(response, 400, { error: { code: "VALIDATION_ERROR", message: error.message } });
    return send(response, 500, { error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." } });
  }
}

class ValidationError extends Error {}
function validateString(value: unknown, field: string): asserts value is string { if (typeof value !== "string" || value.trim() === "") throw new ValidationError(`${field} is required.`); }
function authenticate(request: IncomingMessage, service: AuthService) { const value = request.headers.authorization; if (!value?.startsWith("Bearer ")) throw new AuthError("UNAUTHORIZED", "Authentication is required."); try { return service.authenticateAccessToken(value.slice(7)); } catch { throw new AuthError("UNAUTHORIZED", "Authentication is invalid."); } }
function parseStatus(value: string | null): OrderStatus | undefined { if (!value) return undefined; if (!(["CREATED", "CONFIRMED", "PREPARING", "DELIVERING", "COMPLETED", "CANCELLED"] as const).includes(value as OrderStatus)) throw new ValidationError("status is invalid."); return value as OrderStatus; }
function readMenuItemIds(url: URL): string[] {
  const raw = url.searchParams.get("ids");
  if (!raw) throw new ValidationError("ids is required.");
  const values = raw.split(",").map((value) => value.trim());
  if (values.some((value) => value === "")) throw new ValidationError("ids must not contain empty values.");
  if (values.some((value) => !isUuid(value))) throw new ValidationError("ids must contain UUID values.");
  const ids = [...new Set(values)];
  if (ids.length > 100) throw new ValidationError("ids must contain at most 100 values.");
  return ids;
}
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function readPositiveQuery(url: URL, key: string, fallback: number, min: number, max: number): number { const value = url.searchParams.get(key); if (!value) return fallback; const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new ValidationError(`${key} is invalid.`); return parsed; }
function send(response: ServerResponse, statusCode: number, body?: unknown): void { response.statusCode = statusCode; if (body === undefined) { response.end(); return; } response.setHeader("content-type", "application/json; charset=utf-8"); response.end(JSON.stringify(body)); }
async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> { let raw = ""; for await (const chunk of request) raw += chunk; try { const parsed: unknown = JSON.parse(raw); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); return parsed as Record<string, unknown>; } catch { throw new ValidationError("Request body must be a JSON object."); } }
async function readOptionalJson(request: IncomingMessage): Promise<Record<string, unknown>> { let raw = ""; for await (const chunk of request) raw += chunk; if (raw === "") return {}; try { const parsed: unknown = JSON.parse(raw); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); return parsed as Record<string, unknown>; } catch { throw new ValidationError("Request body must be a JSON object."); } }
function close(server: Server): Promise<void> { return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
