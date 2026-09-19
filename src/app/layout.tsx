import type { Metadata } from "next";
import "./globals.css";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import AdminShell from "@/components/AdminShell";

export const metadata: Metadata = {
  title: "Crafteey Admin",
  description: "Internal admin dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AdminAuthProvider>
          <AdminShell>{children}</AdminShell>
        </AdminAuthProvider>
      </body>
    </html>
  );
}