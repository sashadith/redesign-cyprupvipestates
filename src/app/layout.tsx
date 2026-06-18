import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cyprus VIP Estates",
  applicationName: "Cyprus VIP Estates",
  openGraph: {
    siteName: "Cyprus VIP Estates",
  },
  description: "Cyprus VIP Estates - Luxury Real Estate in Cyprus",
};

const Layout = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};

export default Layout;
