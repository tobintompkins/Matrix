import type { ReactNode } from "react";
import FieldIdentityProvider from "./FieldIdentityProvider";
export default function FieldLayout({ children }: { children: ReactNode }) {
  return <FieldIdentityProvider>{children}</FieldIdentityProvider>;
}
