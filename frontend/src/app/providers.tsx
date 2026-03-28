"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#ffffff",
            color: "#2d2a33",
            borderRadius: "16px",
            border: "1px solid #e8e0d8",
            boxShadow: "0 4px 20px rgba(45, 42, 51, 0.06)",
            fontSize: "14px",
            padding: "12px 16px",
          },
          success: {
            iconTheme: {
              primary: "#6db89a",
              secondary: "#ffffff",
            },
          },
          error: {
            iconTheme: {
              primary: "#d4877f",
              secondary: "#ffffff",
            },
          },
        }}
      />
      {children}
    </QueryClientProvider>
  );
}

