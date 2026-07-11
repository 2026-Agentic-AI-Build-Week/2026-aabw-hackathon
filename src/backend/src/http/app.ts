import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AuthError, AuthService } from "../auth/auth-service.js";
import type { AuthServiceDependencies } from "../auth/auth-service.js";

type RequestOptions = { method?: string; body?: unknown; headers?: Record<string, string> };
type Application = { listen(port: number): Promise<{ close(): Promise<void>; request(path: string, options?: RequestOptions): Promise<Response> }> };

export function createAuthApplication(dependencies: AuthServiceDependencies): Application {
  const service = new AuthService(dependencies);
  return {
    async listen(port) {
      const server = createServer((request, response) => void handle(request, response, service));
      await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Server did not bind to a TCP port.");
      return {
        close: () => close(server),
        request: (path, options = {}) => fetch(`http://127.0.0.1:${address.port}${path}`, {
          method: options.method ?? "GET",
          headers: { ...(options.body === undefined ? {} : { "content-type": "application/json" }), ...options.headers },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        }),
      };
    },
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, service: AuthService): Promise<void> {
  try {
    const url = request.url?.split("?")[0];
    if (request.method === "POST" && url === "/api/auth/login") {
      const body = await readJson(request); validateString(body.email, "email"); validateString(body.password, "password"); validateString(body.device_id, "device_id");
      return send(response, 200, await service.login(body.email, body.password, body.device_id));
    }
    if (request.method === "POST" && url === "/api/auth/refresh") {
      const body = await readJson(request); validateString(body.refresh_token, "refresh_token"); validateString(body.device_id, "device_id");
      return send(response, 200, await service.refresh(body.refresh_token, body.device_id));
    }
    const principal = authenticate(request, service);
    if (request.method === "POST" && url === "/api/auth/logout") { await service.logout(principal); return send(response, 204); }
    if (request.method === "GET" && url === "/api/auth/me") { return send(response, 200, await service.me(principal)); }
    return send(response, 404, { error: { code: "NOT_FOUND", message: "Route not found." } });
  } catch (error) {
    if (error instanceof AuthError) return send(response, error.statusCode, { error: { code: error.code, message: error.message } });
    if (error instanceof ValidationError) return send(response, 400, { error: { code: "VALIDATION_ERROR", message: error.message } });
    return send(response, 401, { error: { code: "UNAUTHORIZED", message: "Authentication failed." } });
  }
}

class ValidationError extends Error {}

function validateString(value: unknown, field: string): asserts value is string { if (typeof value !== "string" || value.trim() === "") throw new ValidationError(`${field} is required.`); }
function authenticate(request: IncomingMessage, service: AuthService) { const value = request.headers.authorization; if (!value?.startsWith("Bearer ")) throw new AuthError("UNAUTHORIZED", "Authentication is required."); try { return service.authenticateAccessToken(value.slice(7)); } catch { throw new AuthError("UNAUTHORIZED", "Authentication is invalid."); } }
function send(response: ServerResponse, statusCode: number, body?: unknown): void { response.statusCode = statusCode; if (body === undefined) { response.end(); return; } response.setHeader("content-type", "application/json; charset=utf-8"); response.end(JSON.stringify(body)); }
async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> { let raw = ""; for await (const chunk of request) raw += chunk; try { const parsed: unknown = JSON.parse(raw); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); return parsed as Record<string, unknown>; } catch { throw new ValidationError("Request body must be a JSON object."); } }
function close(server: Server): Promise<void> { return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
