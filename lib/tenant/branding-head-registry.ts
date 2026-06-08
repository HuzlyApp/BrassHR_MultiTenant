import type { TenantBranding } from "@/lib/tenant/tenant-branding";

const stack: TenantBranding[] = [];
const listeners = new Set<() => void>();

export function pushActiveBranding(branding: TenantBranding): () => void {
  stack.push(branding);
  listeners.forEach((listener) => listener());
  return () => {
    const index = stack.lastIndexOf(branding);
    if (index >= 0) stack.splice(index, 1);
    listeners.forEach((listener) => listener());
  };
}

export function getActiveBranding(): TenantBranding | null {
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

export function subscribeActiveBranding(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
