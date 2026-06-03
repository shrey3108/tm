import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "@/store/hooks";
import { setCredentials, logout } from "@/store/slices/authSlice";
import { authService } from "@/apis/auth";
import type { UserLogin, UserRegister } from "@/types/auth";
// import { extractErrorMessage } from "@/utils/error";

/**
 * Mutation hook for user login.
 * Handles dispatching credentials to Redux store and navigating on success.
 */
export function useLoginMutation() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: (credentials: UserLogin) => authService.login(credentials),
    onSuccess: (response) => {
      dispatch(
        setCredentials({
          user: response.user,
          access_token: response.access_token,
          refresh_token: response.refresh_token,
        }),
      );
      navigate("/dashboard");
    },
  });
}

/**
 * Mutation hook for user registration.
 * Navigates to login page after a brief delay on success.
 */
export function useRegisterMutation() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: UserRegister) => authService.register(data),
    onSuccess: () => {
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    },
  });
}

/**
 * Mutation hook for user logout.
 * Clears Redux auth state and invalidates all cached queries.
 */
export function useLogoutMutation() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      // Always clear auth state and redirect
      dispatch(logout());
      queryClient.clear();
      navigate("/login");
    },
  });
}
