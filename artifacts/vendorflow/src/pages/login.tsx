import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shield, Lock } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("john@acme.com");
  const [password, setPassword] = useState("password");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      login(data.user, data.accessToken, data.refreshToken);
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col justify-center items-center p-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-14 h-14 bg-blue-500 text-white rounded-xl flex items-center justify-center font-bold text-2xl shadow-lg shadow-blue-500/30">
          VF
        </div>
        <div className="text-center">
          <h1 className="font-bold text-3xl tracking-tight text-white">VendorFlow</h1>
          <p className="text-slate-400 text-sm mt-1">Enterprise Procurement Platform</p>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-2xl border border-slate-700 bg-slate-800/80 backdrop-blur">
        <CardHeader className="space-y-2 text-center pb-4">
          <CardTitle className="text-2xl font-bold text-white">Sign in</CardTitle>
          <CardDescription className="text-slate-400">Access your procurement dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p><span className="font-medium">Demo credentials</span></p>
                <p>Email: <strong>john@acme.com</strong> · Password: <strong>password</strong></p>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium bg-blue-600 hover:bg-blue-500 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2"><Lock className="w-4 h-4 animate-pulse" /> Signing in...</span>
              ) : (
                "Sign in to VendorFlow"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-slate-500 text-xs">
        JWT-secured · Multi-tenant · Role-based access control
      </p>
    </div>
  );
}
