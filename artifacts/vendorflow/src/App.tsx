import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { SidebarLayout } from "@/components/layout/sidebar-layout";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Vendors from "@/pages/vendors/index";
import VendorNew from "@/pages/vendors/new";
import VendorDetail from "@/pages/vendors/detail";
import VendorEdit from "@/pages/vendors/edit";
import Procurement from "@/pages/procurement/index";
import ProcurementNew from "@/pages/procurement/new";
import ProcurementDetail from "@/pages/procurement/detail";
import ProcurementEdit from "@/pages/procurement/edit";
import Inventory from "@/pages/inventory/index";
import InventoryNew from "@/pages/inventory/new";
import InventoryDetail from "@/pages/inventory/detail";
import InventoryEdit from "@/pages/inventory/edit";
import AuditLogs from "@/pages/audit";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});

function ProtectedPage({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-pulse text-lg font-medium text-muted-foreground">Loading VendorFlow...</div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <SidebarLayout>
      <Component />
    </SidebarLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedPage component={Dashboard} />} />
      <Route path="/dashboard" component={() => <ProtectedPage component={Dashboard} />} />

      <Route path="/vendors/new" component={() => <ProtectedPage component={VendorNew} />} />
      <Route path="/vendors/:id/edit" component={() => <ProtectedPage component={VendorEdit} />} />
      <Route path="/vendors/:id" component={() => <ProtectedPage component={VendorDetail} />} />
      <Route path="/vendors" component={() => <ProtectedPage component={Vendors} />} />

      <Route path="/procurement/new" component={() => <ProtectedPage component={ProcurementNew} />} />
      <Route path="/procurement/:id/edit" component={() => <ProtectedPage component={ProcurementEdit} />} />
      <Route path="/procurement/:id" component={() => <ProtectedPage component={ProcurementDetail} />} />
      <Route path="/procurement" component={() => <ProtectedPage component={Procurement} />} />

      <Route path="/inventory/new" component={() => <ProtectedPage component={InventoryNew} />} />
      <Route path="/inventory/:id/edit" component={() => <ProtectedPage component={InventoryEdit} />} />
      <Route path="/inventory/:id" component={() => <ProtectedPage component={InventoryDetail} />} />
      <Route path="/inventory" component={() => <ProtectedPage component={Inventory} />} />

      <Route path="/audit" component={() => <ProtectedPage component={AuditLogs} />} />
      <Route path="/settings" component={() => <ProtectedPage component={Settings} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
