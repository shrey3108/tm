import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { authService } from "@/apis/auth";
import { useAppDispatch } from "@/store/hooks";
import { logout, setCredentials } from "@/store/slices/authSlice";
import { extractErrorMessage } from "@/utils/error";

export default function ZohoCallbackPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;

    const completeLogin = async () => {
      try {
        const user = await authService.getMe();
        if (!isActive) {
          return;
        }

        dispatch(setCredentials({ user }));
        navigate(user.permissions.length === 0 ? "/auth/pending" : "/dashboard", {
          replace: true,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        dispatch(logout());
        const message = extractErrorMessage(
          error,
          "Unable to complete Zoho sign-in.",
        );
        navigate(`/login?error=${encodeURIComponent(message)}`, { replace: true });
      }
    };

    void completeLogin();

    return () => {
      isActive = false;
    };
  }, [dispatch, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/50 bg-card px-8 py-10 text-center shadow-xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Completing Zoho sign-in</h1>
          <p className="text-sm text-muted-foreground">
            We are finalizing your session and loading your account.
          </p>
        </div>
      </div>
    </div>
  );
}