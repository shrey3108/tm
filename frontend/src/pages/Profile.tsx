import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, User, ShieldCheck, Calendar } from "lucide-react";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { useAuthUser } from "@/hooks/queries/auth/useAuthUser";
import { extractErrorMessage } from "@/utils/error";

export default function ProfilePage() {
  const { data: user, isLoading: loading, error } = useAuthUser();

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  const errorMessage = extractErrorMessage(error);

  if (errorMessage || !user) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-destructive">
        {errorMessage || "User not found"}
      </div>
    );
  }

  return (
    <AppPageShell width="form">
      <PageHeader title="User Profile" />

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-col items-center">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-2xl">
                {user.full_name?.split(" ").map(n => n[0]).join("") || user.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="mt-4 text-center">{user.full_name || "Anonymous User"}</CardTitle>
            <Badge variant="secondary" className="mt-2 text-primary">
              {user.role_name || "Standard User"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span>Active Status: {user.is_active ? "Active" : "Inactive"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase">Full Name</p>
                <p className="mt-1 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {user.full_name || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase">Email Address</p>
                <p className="mt-1 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase">Joined On</p>
                <p className="mt-1 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase">Account Status</p>
                <p className="mt-1">
                  <Badge variant={user.is_active ? "default" : "destructive"}>
                    {user.is_active ? "Active" : "Inactive"}
                  </Badge>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppPageShell>
  );
}
