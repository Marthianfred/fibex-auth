import { useEffect } from "react";
import { LoginPage } from "./components/pages/LoginPage";
import { FibexDashboard } from "./components/dashboard/FibexDashboard";
import { authClient } from "./lib/auth-client";

function App() {
  const pathname = window.location.pathname;

  if (pathname === "/login" || pathname === "/" || pathname === "") {
    return <LoginRedirect><LoginPage /></LoginRedirect>;
  }

  return <AuthGuard><FibexDashboard /></AuthGuard>;
}

function LoginRedirect({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && session) {
      window.location.href = "/dashboard";
    }
  }, [session, isPending]);

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      </div>
    );
  }

  return <>{children}</>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending, error } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session && !error) {
      window.location.href = "/login";
    }
  }, [session, isPending, error]);

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}

export default App;
