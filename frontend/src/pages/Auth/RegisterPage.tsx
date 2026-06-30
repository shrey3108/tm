/**
 * @module RegisterPage
 * @component RegisterPage
 *
 * Registration page for new user account creation.
 * Provides a form with name, email, and password fields with validation.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { CheckCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { registerSchema, type RegisterFormValues } from "@/schemas/auth";
import { extractErrorMessage } from "@/utils/error";
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
import { INFO } from "@/constants";
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { useRegisterMutation } from "@/hooks/mutations/auth/useAuthMutations";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const registerMutation = useRegisterMutation();

  const error = registerMutation.error
    ? extractErrorMessage(registerMutation.error, "Registration failed. Please try again.")
    : null;

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: RegisterFormValues) => {
    registerMutation.mutate(data);
  };

  if (registerMutation.isSuccess) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/30">
        <header className="absolute left-0 top-0 z-10 flex w-full items-center justify-center px-6 py-5 sm:px-8">
          <Link to="/" className="transition-opacity hover:opacity-80">
            <Logo className="h-10" />
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full max-w-md pt-16 sm:pt-12">
            <Card className="shadow-xl border-border/50 rounded-2xl overflow-hidden bg-card text-center p-4">
              <CardContent className="py-8">
                <div className="mb-6 flex justify-center">
                  <div
                    className="bg-green-100 text-green-600 rounded-full inline-flex items-center justify-center animate-in zoom-in duration-300"
                    style={{ width: "80px", height: "80px" }}
                  >
                    <CheckCircle className="h-10 w-10" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold mb-3">Registration Successful</CardTitle>
                <CardDescription className="text-base mb-6">
                  Your account has been created successfully! Redirecting you to the login page...
                </CardDescription>
                <Link to="/login">
                  <Button className="w-full h-12 text-base font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]">
                    Go to Login Now
                  </Button>
                </Link>
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
            <CardHeader className="space-y-2 pt-5 pb-6 text-center">
              <CardTitle className="text-3xl font-extrabold tracking-tight">
                Create Account
              </CardTitle>
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
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" className="h-11 rounded-xl" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Creating Account...</span>
                      </div>
                    ) : (
                      "Register"
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="text-primary font-bold hover:underline underline-offset-4"
                  >
                    Sign In
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
  );
};
