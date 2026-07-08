import { Suspense } from "react";
import LoginPage from "./login-content";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando...</div>}>
      <LoginPage />
    </Suspense>
  );
}
