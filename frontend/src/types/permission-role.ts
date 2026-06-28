
/**
 * Base fields for a permission.
 */
export interface PermissionBase {
    name: string;
    description: string;
}

/**
 * Permission returned from read operations.
 */
export interface PermissionRead extends PermissionBase {
    id: string;
    created_at?: string;
}

/**
 * Payload for creating a new permission.
 */
export interface PermissionCreate extends PermissionBase { }

/**
 * Base fields for a role.
 */
export interface RoleBase {
    name: string;
}

/**
 * Payload for creating a new role.
 */
export interface RoleCreate extends RoleBase {
    permission_ids?: string[];
}

/**
 * Payload for updating an existing role.
 */
export interface RoleUpdate {
    name?: string;
    permission_ids?: string[];
}

/**
 * Role returned from read operations.
 */
export interface RoleRead extends RoleBase {
    id: string;
    created_at?: string;
    updated_at?: string;
    user_count: number
}

/**
 * Role with its associated permissions.
 */
export interface RoleWithPermissions extends RoleRead {
    permissions: PermissionRead[];
}

/**
 * Payload for creating a new user via admin.
 */
export interface UserAdminCreate {
    email: string;
    password?: string;
    full_name?: string;
    is_active?: boolean;
    role_id: string;
}

/**
 * Payload for updating an existing user via admin.
 */
export interface UserAdminUpdate {
    full_name?: string;
    is_active?: boolean;
    role_id?: string;
}

/**
 * User returned from admin read operations.
 */
export interface UserAdminRead {
    id: string;
    full_name?: string;
    email: string;
    is_active: boolean;
    role_id: string;
    role_name: string;
    created_at?: string;
    updated_at?: string;
}

/**
 * User with their role details included.
 */
export interface UserWithRole extends UserAdminRead {
    role: RoleRead;
}