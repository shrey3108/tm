/**
 * Main App component.
 * Sets up React Router for navigation throughout the application.
 */

import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "@/routes/AppRoutes";
import { ToastProvider } from "@/components/shared/ToastProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/utils/query-client";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BackgroundPollingManager } from "@/components/shared";

function App() {
  return (
    <Router>
      <TooltipProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <AppRoutes />
            <BackgroundPollingManager />
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </ToastProvider>
      </TooltipProvider>
    </Router>
  );
}

export default App;
