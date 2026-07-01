/**
 * @module query-client
 * Shared React Query client configuration for data fetching and caching state management.
 */
import { QueryClient } from "@tanstack/react-query";
/**
 * Pre-configured `QueryClient` instance for `@tanstack/react-query`.
 *
 * Default query configuration:
 * - `staleTime`: 5 minutes (cached data remains fresh for 5 minutes).
 * - `gcTime`: 10 minutes (unused query data is garbage collected after 10 minutes).
 * - `retry`: 1 (failed requests are retried once before throwing error).
 * - Focus, mount, and reconnect refetches are temporarily disabled.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 Minutes
            gcTime: 1000 * 60 * 10, //  10 Minutes
            retry: 1,
            // TODO: REMOVE AFTER GEP
            refetchOnWindowFocus: true,
            refetchOnMount: false,
            refetchOnReconnect: false,
        }
    }
});
