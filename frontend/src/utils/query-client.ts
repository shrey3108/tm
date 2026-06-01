/**
 * Tanstack Query client setup
 */
import { QueryClient } from "@tanstack/react-query";
/**
 * Initializes and exports a new QueryClient instance for @tanstack/react-query.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 Minutes
            gcTime: 1000 * 60 * 10, //  10 Minutes
            retry: 2,
        }
    }
});