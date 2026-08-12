"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PasswordStrengthIndicator } from "@/components/settings/PasswordStrengthIndicator";
import { calculatePasswordStrength } from "@/lib/password-strength";
import { useTranslation } from "@/hooks/useTranslation";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginInner />
    </Suspense>
  );
}

function AdminLoginInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/admin";

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Setup state
  const [setupUsername, setSetupUsername] = useState("admin");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState("");

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/auth/login");
        if (res.ok) {
          const data = await res.json();
          setConfigured(!!data.configured);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    check();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        // Hard navigation: the Next.js App Router's soft router.replace()
        // does not reliably transition to a middleware-gated route right
        // after an auth-state change (the Router Cache can drop the
        // navigation, leaving the user on the login page until a manual
        // reload). A full document load guarantees the proxy middleware
        // re-runs with the freshly-set HttpOnly session cookie. This works
        // the same over HTTP and HTTPS (Zoraxy).
        window.location.replace(redirect);
      } else {
        toast.error(data.error || t("login.loginFailed"));
      }
    } catch {
      toast.error(t("login.loginFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (setupPassword.length < 12) {
      toast.error(t("login.passwordTooShort"));
      return;
    }
    if (setupPassword !== setupPasswordConfirm) {
      toast.error(t("login.passwordsDoNotMatch"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: setupUsername.trim(),
          password: setupPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t("login.adminAccountCreated"));
        // Hard navigation (see handleLogin): a soft router.replace() can be
        // dropped by the App Router cache after an auth-state change.
        window.location.replace(redirect);
      } else {
        toast.error(data.error || t("login.setupFailed"));
      }
    } catch {
      toast.error(t("login.setupFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // First-run setup: create the admin account.
  if (configured === false) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>{t("login.createAdminAccount")}</CardTitle>
            <CardDescription>
              {t("login.setupDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setupUsername">{t("login.username")}</Label>
                <Input
                  id="setupUsername"
                  value={setupUsername}
                  onChange={(e) => setSetupUsername(e.target.value)}
                  required
                  minLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setupPassword">{t("login.passwordMinChars")}</Label>
                <Input
                  id="setupPassword"
                  type="password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  required
                />
                <PasswordStrengthIndicator strength={calculatePasswordStrength(setupPassword)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setupPasswordConfirm">{t("login.confirmPassword")}</Label>
                <Input
                  id="setupPasswordConfirm"
                  type="password"
                  value={setupPasswordConfirm}
                  onChange={(e) => setSetupPasswordConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("login.creating")}
                  </>
                ) : (
                  t("login.createAdminAccount")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Standard login.
  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>{t("login.adminLogin")}</CardTitle>
          <CardDescription>{t("login.signInToManage")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t("login.username")}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("login.signingIn")}
                </>
              ) : (
                t("login.signIn")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
