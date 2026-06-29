/**
 * Common permission aliases used by the current frontend.
 * This is not an exhaustive registry; permission helpers accept any runtime string.
 */
export const PERMISSIONS = {
  ADMIN_ACCESS: "admin:access",
  ADMIN_ALL: "admin:all",
  ANALYTICS_READ: "analytics:read",
  AUDIT_READ: "audit:read",
  CANDIDATES_ACCESS: "candidates:access",
  CANDIDATES_DECIDE: "candidates:decide",
  DEPARTMENTS_ACCESS: "departments:access",
  DEPARTMENTS_MANAGE: "departments:manage",
  FILES_READ: "files:read",
  JOBS_ACCESS: "jobs:access",
  JOBS_MANAGE: "jobs:manage",
  PERMISSIONS_READ: "permissions:read",
  PERMISSIONS_MANAGE: "permissions:manage",
  ROLES_READ: "roles:read",
  ROLES_MANAGE: "roles:manage",
  SKILLS_ACCESS: "skills:access",
  SKILLS_MANAGE: "skills:manage",
  USERS_READ: "users:read",
  USERS_MANAGE: "users:manage",
  SYSTEM_MANAGE: "system:manage",
  QUESTIONS_MANAGE: "questions:manage",
  QUESTIONS_UPLOAD: "questions:upload",
  ASSOCIATES_ACCESS: "associates:access",
  ASSOCIATES_MANAGE: "associates:manage",
} as const;

export const ADMIN_ALL_PERMISSION = "admin:all";

/**
 * Defines how multiple permissions should be evaluated.
 * - "any": User needs at least one of the specified permissions.
 * - "all": User needs all of the specified permissions.
 */
export type PermissionMatch = "any" | "all";

/**
 * Checks if a user has a specific permission.
 * Users with "admin:all" permission automatically pass all permission checks.
 * @param userPermissions - Array of permissions granted to the user, or null/undefined
 * @param permission - The permission to check for
 * @returns True if the user has the permission or admin:all, false otherwise
 * @example
 * ```ts
 * hasPermission(['users:read'], 'users:read') // true
 * hasPermission(['users:read'], 'users:manage') // false
 * hasPermission(['admin:all'], 'users:manage') // true
 * hasPermission(null, 'users:read') // false
 * ```
 */
export function hasPermission(
  userPermissions: readonly string[] | null | undefined,
  permission: string,
): boolean {
  if (!permission) {
    return true;
  }

  const grantedPermissions = userPermissions ?? [];
  return (
    grantedPermissions.includes(ADMIN_ALL_PERMISSION) ||
    grantedPermissions.includes(permission)
  );
}

/**
 * Checks if a user has at least one of the specified permissions.
 * Users with "admin:all" permission automatically pass all checks.
 * @param userPermissions - Array of permissions granted to the user, or null/undefined
 * @param permissions - Array of permissions to check against
 * @returns True if the user has at least one permission, or if permissions array is empty
 * @example
 * ```ts
 * hasAnyPermission(['users:read'], ['users:read', 'users:manage']) // true
 * hasAnyPermission(['jobs:read'], ['users:read', 'users:manage']) // false
 * hasAnyPermission(['admin:all'], ['users:read', 'jobs:read']) // true
 * ```
 */
export function hasAnyPermission(userPermissions: readonly string[] | null | undefined,
  permissions: readonly string[],
): boolean {
  if (permissions.length === 0) {
    return true;
  }

  return permissions.some((permission) => hasPermission(userPermissions, permission));
}

/**
 * Checks if a user has all of the specified permissions.
 * Users with "admin:all" permission automatically pass all checks.
 * @param userPermissions - Array of permissions granted to the user, or null/undefined
 * @param permissions - Array of permissions to check against
 * @returns True if the user has all permissions, or if permissions array is empty
 * @example
 * ```ts
 * hasAllPermissions(['users:read', 'users:manage'], ['users:read']) // true
 * hasAllPermissions(['users:read'], ['users:read', 'users:manage']) // false
 * hasAllPermissions(['admin:all'], ['users:read', 'jobs:read']) // true
 * ```
 */
export function hasAllPermissions(userPermissions: readonly string[] | null | undefined,
  permissions: readonly string[],
): boolean {
  if (permissions.length === 0) {
    return true;
  }

  return permissions.every((permission) => hasPermission(userPermissions, permission));
}

/**
 * Unified permission check function that supports both "any" and "all" matching strategies.
 * Users with "admin:all" permission automatically pass all checks.
 * @param userPermissions - Array of permissions granted to the user, or null/undefined
 * @param permissions - Single permission string or array of permissions to check
 * @param match - Strategy for evaluating multiple permissions: "any" (at least one) or "all" (all required). Defaults to "any"
 * @returns True if permissions check passes based on the match strategy, or if permissions is null/undefined/empty
 * @example
 * ```ts
 * // Check for any of the permissions
 * hasPermissions(['users:read'], ['users:read', 'users:manage'], 'any') // true
 * 
 * // Check for all permissions
 * hasPermissions(['users:read', 'users:manage'], ['users:read'], 'all') // true
 * hasPermissions(['users:read'], ['users:read', 'users:manage'], 'all') // false
 * ```
 */
export function hasPermissions(userPermissions: readonly string[] | null | undefined,
  permissions: string | readonly string[] | null | undefined,
  match: PermissionMatch = "any",
): boolean {
  if (!permissions) {
    return true;
  }

  const normalizedPermissions = Array.isArray(permissions) ? permissions : [permissions];
  return match === "all"
    ? hasAllPermissions(userPermissions, normalizedPermissions)
    : hasAnyPermission(userPermissions, normalizedPermissions);
}
