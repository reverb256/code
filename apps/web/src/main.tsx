import "@radix-ui/themes/styles.css";
import "./styles/globals.css";

import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Theme
        appearance="dark"
        accentColor="iris"
        grayColor="slate"
        radius="medium"
        scaling="95%"
      >
        <App />
      </Theme>
    </QueryClientProvider>
  </StrictMode>,
);
