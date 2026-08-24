/**
 * Login page for Email/Password and Zoho authentication.
 */

import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, Mail, Lock, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo/index";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INFO } from "@/constants";
import { useLoginMutation } from "@/hooks/mutations/auth/useAuthMutations";
import { useToast } from "@/components/shared/ToastProvider";

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get("error");
  const apiBaseUrl = import.meta.env.VITE_API_URL || "/api/v1";
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [useEmailLogin, setUseEmailLogin] = useState(true);

  const loginMutation = useLoginMutation();

  const handleZohoLogin = () => {
    window.location.assign(`${apiBaseUrl}/oauth/zoho/login`);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    try {
      await loginMutation.mutateAsync({ email, password });
      toast.success("Logged in successfully");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Invalid login credentials");
    }
  };

  const handleQuickSuperAdminLogin = async () => {
    setEmail("admin@example.com");
    setPassword("admin123");
    try {
      await loginMutation.mutateAsync({
        email: "admin@example.com",
        password: "admin123",
      });
      toast.success("Super Admin logged in successfully");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to log in as Super Admin");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="absolute left-0 top-0 z-10 flex w-full items-center justify-center px-6 py-5 sm:px-8">
        <Link to="/" className="transition-opacity hover:opacity-80">
          <Logo className="h-10" />
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="w-full max-w-md pt-16 sm:pt-12">
          <Card className="shadow-xl border-border/50 rounded-2xl overflow-hidden bg-card">
            <CardHeader className="space-y-2 pt-6 pb-4 text-center">
              <CardTitle className="text-3xl font-extrabold tracking-tight">
                Welcome Back
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Sign in to manage your hiring pipeline
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-6 space-y-5">
              {(errorParam || loginMutation.error) && (
                <div
                  role="alert"
                  className="bg-destructive/10 text-destructive text-sm p-4 rounded-xl border border-destructive/20 animate-in fade-in slide-in-from-top-1"
                >
                  {errorParam || (loginMutation.error as any)?.response?.data?.detail || "Login failed"}
                </div>
              )}

              {useEmailLogin ? (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 h-11 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loginMutation.isPending}
                    className="w-full h-11 text-sm font-bold rounded-xl"
                  >
                    {loginMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Sign In
                  </Button>
                </form>
              ) : (
                <Button
                  type="button"
                  className="w-full h-12 text-base font-bold rounded-xl"
                  onClick={handleZohoLogin}
                >
                  Login with Zoho
                </Button>
              )}

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border/60"></div>
                <span className="flex-shrink mx-3 text-xs text-muted-foreground uppercase">Or</span>
                <div className="flex-grow border-t border-border/60"></div>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 text-xs font-medium rounded-xl border-dashed"
                  onClick={() => setUseEmailLogin(!useEmailLogin)}
                >
                  {useEmailLogin ? "Sign in via Zoho OAuth" : "Sign in with Email & Password"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={loginMutation.isPending}
                  className="w-full h-10 text-xs font-semibold rounded-xl bg-primary/10 text-primary hover:bg-primary/20"
                  onClick={handleQuickSuperAdminLogin}
                >
                  <ShieldCheck className="h-4 w-4 mr-1.5" />
                  Quick Super Admin Login (Dev)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <footer className="flex w-full items-center justify-center px-6 py-5 sm:px-8">
        <p className="text-sm text-muted-foreground">{INFO.copyright}</p>
      </footer>
    </div>
  );
}

