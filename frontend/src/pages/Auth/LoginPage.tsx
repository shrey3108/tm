/**
 * Login page for Zoho-only authentication.
 */

import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo/index";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { INFO } from "@/constants";

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");
  const apiBaseUrl = import.meta.env.VITE_API_URL || "/api/v1";

  const handleZohoLogin = () => {
    window.location.assign(`${apiBaseUrl}/oauth/zoho/login`);
  };

  return (
    <>
      <div className="flex min-h-screen flex-col bg-muted/30">
        <header className="absolute left-0 top-0 z-10 flex w-full items-center justify-center px-6 py-5 sm:px-8">
          <Link to="/" className="transition-opacity hover:opacity-80">
            <Logo className="h-10" />
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full max-w-md pt-16 sm:pt-12">
            <Card className="shadow-xl border-border/50 rounded-2xl overflow-hidden bg-card">
              <CardHeader className="space-y-2 pt-5 pb-6 text-center">
                <CardTitle className="text-3xl font-extrabold tracking-tight">
                  Welcome Back
                </CardTitle>
                <CardDescription className="text-muted-foreground text-base">
                  Sign in with your Zoho account to manage your hiring
                </CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-5">
                {error && (
                  <div
                    role="alert"
                    className="bg-destructive/10 text-destructive text-sm p-4 rounded-xl border border-destructive/20 mb-6 animate-in fade-in slide-in-from-top-1"
                  >
                    {error}
                  </div>
                )}
                <div className="space-y-4">
                  <Button
                    type="button"
                    className="w-full h-12 text-base font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                    onClick={handleZohoLogin}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 opacity-0" />
                      <span>Login with Zoho</span>
                    </div>
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
    </>
  );
};

