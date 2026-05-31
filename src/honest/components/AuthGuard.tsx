import { memo, ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { initAuth, useAuth } from "../lib/auth";
import { Card, PageContainer } from "./ui";

const AuthGuard = memo(({ children }: { children: ReactNode }) => {
  const session = useAuth((s) => s.session);
  const loading = useAuth((s) => s.loading);

  useEffect(() => {
    initAuth();
  }, []);

  if (loading) {
    return (
      <PageContainer>
        <Card padding="md">
          <div className="text-center text-neutral-400 text-sm py-8">
            Verificando sessão…
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
});
AuthGuard.displayName = "AuthGuard";

export default AuthGuard;
