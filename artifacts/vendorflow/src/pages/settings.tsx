import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Building2 } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 pb-12 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Profile</CardTitle>
          <CardDescription>Your account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-xl font-semibold">{user?.name}</div>
              <div className="text-muted-foreground">{user?.email}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="text-xs text-muted-foreground mb-1">Role</div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="font-medium capitalize">{user?.role}</span>
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="text-xs text-muted-foreground mb-1">Account ID</div>
              <div className="font-mono text-sm font-medium">#{user?.id}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> Organization</CardTitle>
          <CardDescription>Your tenant and workspace details.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="text-xs text-muted-foreground mb-1">Tenant ID</div>
              <div className="font-mono text-sm font-medium">#{user?.tenantId}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="text-xs text-muted-foreground mb-1">Platform</div>
              <div className="font-medium">VendorFlow Enterprise</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About VendorFlow</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">VendorFlow is an enterprise procurement management platform that helps operations teams manage vendors, purchase orders, and inventory with full audit trails.</p>
          <div className="mt-4 flex gap-2">
            <Badge variant="outline">v1.0.0</Badge>
            <Badge variant="outline">Enterprise</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
