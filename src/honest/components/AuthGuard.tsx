import { memo, ReactNode } from "react";

const AuthGuard = memo(({ children }: { children: ReactNode }) => <>{children}</>);
AuthGuard.displayName = "AuthGuard";

export default AuthGuard;
