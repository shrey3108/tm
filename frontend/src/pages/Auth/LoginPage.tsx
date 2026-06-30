/**
 * @module LoginPage
 * @component LoginPage
 *
 * Login page for user authentication.
 * Provides email/password form with validation and error handling.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Logo } from "@/components/logo/index"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loginSchema, type LoginFormValues } from "@/schemas/auth";
import { extractErrorMessage } from "@/utils/error";
import { INFO } from "@/constants";
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { useLoginMutation } from "@/hooks/mutations/auth/useAuthMutations";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const loginMutation = useLoginMutation();

  const error = loginMutation.error
    ? extractErrorMessage(loginMutation.error, "Failed to login. Please check your credentials.")
    : null;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
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
                  Sign in to manage your hiring
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
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Email Address</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="name@example.com"
                                autoComplete="email"
                                className="h-11 rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Password</FormLabel>
                            <InputGroup className="h-11 rounded-xl">
                              <InputGroupInput
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                {...field}
                                className="h-11 rounded-xl"
                              />
                              <InputGroupAddon align={"inline-end"}>
                                <InputGroupButton
                                  onClick={() => setShowPassword(!showPassword)}
                                  size="icon-sm"
                                  variant="ghost"
                                >
                                  {showPassword ? (
                                    <EyeOff className="size-5 text-muted-foreground/70" />
                                  ) : (
                                    <Eye className="size-5 text-muted-foreground/70" />
                                  )}
                                </InputGroupButton>
                              </InputGroupAddon>
                            </InputGroup>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Signing In...</span>
                        </div>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </form>
                </Form>

                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <Link
                      to="/register"
                      className="text-primary font-bold hover:underline underline-offset-4"
                    >
                      Create one
                    </Link>
                  </p>
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

