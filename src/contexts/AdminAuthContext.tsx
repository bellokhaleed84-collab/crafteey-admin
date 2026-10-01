"use client";

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { auth } from "@/lib/firebase/clientApp";
import {
  onAuthStateChanged,
  User,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import type { AdminRole, Permission } from "@/lib/permissions";

export type AccessState = "signed_out" | "loading" | "ok" | "needs_verification" | "no_access" | "error";

export interface AdminProfile {
  name: string;
  email: string;
  role: AdminRole;
  permissions: Permission[];
}

interface AdminAuthContextType {
  user: User | null;
  loading: boolean; // true until Firebase says whether someone is signed in
  access: AccessState; // whether the signed-in person is an active admin
  accessMessage: string | null;
  admin: AdminProfile | null;
  can: (permission: Permission) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  resendVerification: () => Promise<void>;
  refreshAccess: () => Promise<AccessState>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<AccessState>("signed_out");
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);

  const loadAccess = useCallback(async (u: User, forceRefresh = false): Promise<AccessState> => {
    setAccess("loading");
    try {
      const token = await u.getIdToken(forceRefresh);
      const res = await fetch("/api/admin/me", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.admin) {
        setAdmin(data.admin as AdminProfile);
        setAccessMessage(null);
        setAccess("ok");
        return "ok";
      }

      setAdmin(null);
      if (res.status === 403 && data?.needsEmailVerification) {
        setAccess("needs_verification");
        return "needs_verification";
      }
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        setAccessMessage(data?.error || "This account doesn't have admin access.");
        setAccess("no_access");
        return "no_access";
      }
      setAccessMessage("Couldn't check your access. Try again.");
      setAccess("error");
      return "error";
    } catch {
      setAdmin(null);
      setAccessMessage("Couldn't reach the server. Check your connection and try again.");
      setAccess("error");
      return "error";
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) {
        void loadAccess(firebaseUser);
      } else {
        setAdmin(null);
        setAccessMessage(null);
        setAccess("signed_out");
      }
    });
    return () => unsubscribe();
  }, [loadAccess]);

  const handleSignIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const handleSignUp = async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // The account exists; the verify screen has a Resend button.
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    setAdmin(null);
    setAccess("signed_out");
  };

  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  const resendVerification = async () => {
    const u = auth.currentUser;
    if (!u) throw new Error("Not signed in");
    await sendEmailVerification(u);
  };

  // After verifying the email: reload the user and fetch a fresh token that
  // carries the verified flag, then check access again.
  const refreshAccess = async (): Promise<AccessState> => {
    const u = auth.currentUser;
    if (!u) return "signed_out";
    await u.reload();
    return loadAccess(auth.currentUser ?? u, true);
  };

  const can = useCallback((permission: Permission) => !!admin && admin.permissions.includes(permission), [admin]);

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        loading,
        access,
        accessMessage,
        admin,
        can,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        getIdToken,
        resendVerification,
        refreshAccess,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return context;
};