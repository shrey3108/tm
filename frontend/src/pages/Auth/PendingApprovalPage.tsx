import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useLogoutMutation } from "@/hooks/mutations/auth/useAuthMutations";

export default function PendingApprovalPage() {
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-border/50 bg-card p-8 text-center shadow-xl">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Account Pending
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Waiting for access approval</h1>
          <p className="text-sm text-muted-foreground">
            Your Zoho account has been created successfully, but your role is still restricted.
            Contact an administrator to assign your working permissions.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            Sign out
          </Button>
          <Button type="button" onClick={() => navigate("/dashboard")}>
            Try dashboard again
          </Button>
        </div>
      </div>
    </div>
  );
}