import apiClient from "@/apis/client";
import type {
  UserLogin,
  LoginResponse,
  UserRead,
  UserRegister,
  RefreshTokenRequest,
} from "@/types/auth";

/**
 * Authentication service for user login, registration, and profile management.
 * Provides methods for communicating with the authentication API endpoints.
 */
export const authService = {
  /**
   * Authenticates a user with email and password.
   * @param credentials - User login credentials
   * @returns Promise resolving to login response with tokens and user data
   * @throws {Error} When credentials are invalid or server returns an error
   * @example
   * ```ts
   * const response = await authService.login({ email: "user@example.com", password: "password123" });
   * console.log(response.access_token);
   * ```
   */
  login: async (credentials: UserLogin): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/users/login", credentials);
    return response.data;
  },

  /**
   * Registers a new user account.
   * @param userIn - User registration data
   * @returns Promise resolving to the created user's data
   * @throws {Error} When email is already taken or validation fails
   */
  register: async (userIn: UserRegister): Promise<UserRead> => {
    const response = await apiClient.post<UserRead>("/users/register", userIn);
    return response.data;
  },

  /**
   * Retrieves the current authenticated user's profile information.
   * @returns Promise resolving to the current user's data
   * @throws {Error} When user is not authenticated
   */
  getMe: async (): Promise<UserRead> => {
    const response = await apiClient.get<UserRead>("/users/me");
    return response.data;
  },

  /**
   * Retrieves a user's profile information by ID.
   * @param userId - The unique identifier of the user
   * @returns Promise resolving to the user's profile data
   * @throws {Error} When user is not found
   */
  getUser: async (userId: string): Promise<UserRead> => {
    const response = await apiClient.get<UserRead>(`/users/${userId}`);
    return response.data;
  },

  /**
   * Refreshes the access token using a refresh token.
   * @param params - Refresh token request payload
   * @returns Promise resolving to login response with new tokens and user data
   * @throws {Error} When refresh token is invalid or expired
   */
  refreshToken: async (params?: RefreshTokenRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/users/refresh", params);
    return response.data;
  },

  /**
   * Logs out the current user by clearing tokens on the server.
   * @throws {Error} When logout fails
   */
  logout: async (): Promise<void> => {
    await apiClient.post("/users/logout");
  },
};
