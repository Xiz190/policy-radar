"use server";

async function createMockRequest(url: string, method: string, body?: string): Promise<Request> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  
  const token = process.env.ADMIN_TOKEN;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  return new Request(url, {
    method,
    headers,
    body,
  });
}

export async function proxyGet(url: string): Promise<Response> {
  const req = await createMockRequest(url, "GET");
  return fetch(req);
}

export async function proxyPost(url: string, body?: Record<string, unknown>): Promise<Response> {
  const req = await createMockRequest(url, "POST", body ? JSON.stringify(body) : undefined);
  return fetch(req);
}

export async function proxyDelete(url: string): Promise<Response> {
  const req = await createMockRequest(url, "DELETE");
  return fetch(req);
}

export async function proxyPut(url: string, body?: Record<string, unknown>): Promise<Response> {
  const req = await createMockRequest(url, "PUT", body ? JSON.stringify(body) : undefined);
  return fetch(req);
}

export async function batchMarkAllRead(): Promise<Response> {
  return proxyPost("/api/monitor/items/batch", { action: "mark-all-read" });
}

export async function batchMarkStarred(itemIds: string[]): Promise<Response> {
  return proxyPost("/api/monitor/items/batch", { action: "mark-starred", itemIds });
}

export async function batchMarkUnstarred(itemIds: string[]): Promise<Response> {
  return proxyPost("/api/monitor/items/batch", { action: "mark-unstarred", itemIds });
}

export async function batchMarkRead(itemIds: string[]): Promise<Response> {
  return proxyPost("/api/monitor/items/batch", { action: "mark-read", itemIds });
}

export async function batchDelete(itemIds: string[]): Promise<Response> {
  return proxyPost("/api/monitor/items/batch", { action: "delete", itemIds });
}

export async function recaptureItem(sourceId: string, url: string): Promise<Response> {
  return proxyPost("/api/monitor/items/recapture", { sourceId, url });
}

export async function deleteDepartment(departmentName: string): Promise<Response> {
  return proxyDelete(`/api/monitor/sources/departments?departmentName=${encodeURIComponent(departmentName)}`);
}

export async function saveSources(formData: FormData): Promise<Response> {
  const headers = new Headers();
  const token = process.env.ADMIN_TOKEN;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch("/api/monitor/sources/batch", {
    method: "POST",
    body: formData,
    headers,
  });
}