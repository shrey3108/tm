/**
 * User data returned from read operations.
 * Represents an authenticated user with their profile information.
 */
export interface UserRead {
  /** Unique identifier for the user */
  id: string;
  /** User's full name, may be null if not provided */
  full_name: string | null;
  /** User's email address, used for authentication */
  email: string;
  /** Whether the user account is active */
  is_active: boolean;
  /** Role identifier determining user permissions */
  role_id: string;
  /** Name of the role (e.g., "admin", "recruiter") */
  role_name?: string | null;
  /** List of permission names assigned to the user's role */
  permissions: string[];
  /** Timestamp when the user was created */
  created_at: string | null;
  /** Timestamp when the user was last updated */
  updated_at: string | null;
}

/**
 * Payload for creating a new user.
 * Used during user registration.
 */
export interface UserCreate {
  /** User's email address, required for authentication */
  email: string;
  /** User's password, optional for admin-created users */
  password?: string;
  /** User's full name */
  full_name?: string | null;
  /** Whether the user account should be active on creation */
  is_active?: boolean;
  /** Role identifier to assign to the user */
  role_id: string;
}

/**
 * Credentials payload for user login.
 */
export interface UserLogin {
  /** User's email address */
  email: string;
  /** User's password */
  password: string;
}

/**
 * Payload for initial user registration.
 */
export interface UserRegister {
  /** User's email address */
  email: string;
  /** User's password */
  password: string;
  /** User's full name */
  full_name: string;
}

/**
 * Response returned after successful authentication.
 * Contains tokens for API access and the authenticated user data.
 */
export interface LoginResponse {
  /** JWT access token for API authentication (optional if delivered via HttpOnly cookie) */
  access_token?: string;
  /** JWT refresh token for obtaining new access tokens (optional if delivered via HttpOnly cookie) */
  refresh_token?: string;
  /** Type of token (e.g., "bearer") */
  token_type: string;
  /** Timestamp when the access token expires */
  expires_at?: string;
  /** Timestamp when the refresh token expires */
  refresh_token_expires_at?: string;
  /** The authenticated user's data */
  user: UserRead;
}

/**
 * Schema for refreshing an access token.
 */
export interface RefreshTokenRequest {
  /** The refresh token to use for obtaining a new access token */
  refresh_token: string;
}
