import { requirePermission } from '@/server/auth/permissions';
import { PERMISSIONS } from '@/server/auth/permission-catalog';
import type { AuthorizationContext } from '@/server/auth/permissions';

/**
 * Session-based authorization for the Inventory module — Step 2.4.6A1.
 *
 * These helpers resolve the caller's identity from the Better Auth session and
 * return the resolved `AuthorizationContext` (throwing AuthenticationError /
 * AuthorizationError otherwise). Executors receive the context through the
 * shared `authorizeInventoryRead` / `authorizeInventoryAdjust` boundary and
 * never resolve identity themselves. Kept separate so real-service tests can
 * import the executor chain without loading `next/headers` / Better Auth.
 */

export async function requireInventoryAdjust(): Promise<AuthorizationContext> {
  return requirePermission(PERMISSIONS.inventory.adjust);
}

export async function requireInventoryRead(): Promise<AuthorizationContext> {
  return requirePermission(PERMISSIONS.inventory.read);
}
