import { ToastProvider } from "@/components/shared/ToastProvider";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/utils/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { BackgroundPollingManager } from "@/components/shared/BackgroundPollingManager";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

/**
 * Root Layout that wraps all routes with necessary context providers
 * and Suspense boundary.
 */
export const RootLayout = () => {
    return (
        <TooltipProvider>
            <ToastProvider>
                <QueryClientProvider client={queryClient}>
                    <Suspense fallback={<LoadingSpinner />}>
                        <Outlet />
                    </Suspense>
                    <BackgroundPollingManager />
                    <ReactQueryDevtools initialIsOpen={false} />
                </QueryClientProvider>
            </ToastProvider>
        </TooltipProvider>
    );
};