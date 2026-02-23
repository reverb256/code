import { Layout } from "@/components/Layout";
import { LoginForm } from "@/components/LoginForm";
import { useAuthStore } from "@/stores/authStore";

export function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Layout /> : <LoginForm />;
}
