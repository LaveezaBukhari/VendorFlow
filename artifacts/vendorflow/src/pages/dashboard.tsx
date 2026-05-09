import { useGetDashboardStats, useGetSpendingByVendor, useGetOrdersByStatus, useListInventory, useListPurchaseOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, ShoppingCart, AlertCircle, DollarSign, Package, Clock, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const COLORS = ['#1e293b', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: spending, isLoading: spendingLoading } = useGetSpendingByVendor();
  const { data: orderStatus, isLoading: orderStatusLoading } = useGetOrdersByStatus();
  const { data: inventory } = useListInventory();
  const { data: orders } = useListPurchaseOrders();

  const lowStock = inventory?.filter(i => i.quantity <= i.reorderLevel).slice(0, 5) || [];
  const recentOrders = orders?.slice(0, 5) || [];

  if (statsLoading || spendingLoading || orderStatusLoading) return <div className="p-8 flex items-center justify-center h-full">Loading dashboard...</div>;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-muted-foreground">Procurement overview and key metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard 
          title="Total Vendors" 
          value={stats?.totalVendors || 0} 
          icon={Building2} 
        />
        <MetricCard 
          title="Active Orders" 
          value={stats?.activeOrders || 0} 
          icon={ShoppingCart} 
        />
        <MetricCard 
          title="Pending Approvals" 
          value={stats?.pendingApprovals || 0} 
          icon={Clock} 
          trend={stats?.pendingApprovals ? "Requires action" : "All clear"}
          trendUp={!!stats?.pendingApprovals}
        />
        <MetricCard 
          title="Total Spending" 
          value={`$${(stats?.totalSpending || 0).toLocaleString()}`} 
          icon={DollarSign} 
        />
        <MetricCard 
          title="Inventory Value" 
          value={`$${(stats?.inventoryValue || 0).toLocaleString()}`} 
          icon={Package} 
        />
        <MetricCard 
          title="Low Stock Items" 
          value={stats?.lowStockCount || 0} 
          icon={AlertCircle}
          trend={stats?.lowStockCount ? "Critical" : "Healthy"}
          trendUp={!!stats?.lowStockCount}
          alert={!!stats?.lowStockCount}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Spending by Vendor</CardTitle>
            <CardDescription>Top 5 vendors by total spending</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spending?.slice(0, 5) || []} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="vendorName" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `$${value}`}
                />
                <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="totalSpent" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Orders by Status</CardTitle>
            <CardDescription>Current state of all purchase orders</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderStatus || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                >
                  {(orderStatus || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Recent Purchase Orders</CardTitle>
              <CardDescription>Latest procurement activity</CardDescription>
            </div>
            <Link href="/procurement" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No recent orders</div>
              ) : (
                recentOrders.map(order => (
                  <Link key={order.id} href={`/procurement/${order.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors cursor-pointer group">
                      <div>
                        <div className="font-medium group-hover:text-primary transition-colors">{order.poNumber}</div>
                        <div className="text-sm text-muted-foreground">{order.vendorName}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${order.totalAmount.toLocaleString()}</div>
                        <Badge variant="outline" className="capitalize mt-1">{order.status}</Badge>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Low Stock Alerts</CardTitle>
              <CardDescription>Items at or below reorder level</CardDescription>
            </div>
            <Link href="/inventory" className="text-sm text-primary hover:underline flex items-center gap-1">
              View inventory <ArrowRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStock.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">Inventory levels are healthy</div>
              ) : (
                lowStock.map(item => (
                  <Link key={item.id} href={`/inventory/${item.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer group">
                      <div>
                        <div className="font-medium text-destructive">{item.name}</div>
                        <div className="text-sm text-destructive/80">SKU: {item.sku}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-destructive">{item.quantity} in stock</div>
                        <div className="text-xs text-destructive/70 mt-1">Reorder at {item.reorderLevel}</div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, trend, trendUp, alert }: any) {
  return (
    <Card className={`border-0 shadow-sm ring-1 ${alert ? 'ring-destructive/50 bg-destructive/5' : 'ring-border/50'}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className={`text-sm font-medium ${alert ? 'text-destructive/80' : 'text-muted-foreground'}`}>{title}</p>
            <p className={`text-3xl font-bold ${alert ? 'text-destructive' : ''}`}>{value}</p>
          </div>
          <div className={`p-3 rounded-full ${alert ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend && (
          <div className={`mt-4 text-sm font-medium ${alert ? 'text-destructive' : 'text-muted-foreground'}`}>
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
