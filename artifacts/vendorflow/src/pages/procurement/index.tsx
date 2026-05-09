import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListPurchaseOrders } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ShoppingCart, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  received: "bg-purple-100 text-purple-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function Procurement() {
  const { data: orders, isLoading } = useListPurchaseOrders();
  const [statusFilter, setStatusFilter] = useState("all");
  const [, setLocation] = useLocation();

  const filtered = statusFilter === "all" ? orders : orders?.filter(o => o.status === statusFilter);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Procurement</h1>
          <p className="text-muted-foreground">Manage purchase orders and approval workflows.</p>
        </div>
        <Button onClick={() => setLocation("/procurement/new")} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Order
        </Button>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="submitted">Submitted</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="received">Received</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading orders...</div>
          ) : !filtered?.length ? (
            <div className="p-12 text-center flex flex-col items-center">
              <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">No purchase orders</h3>
              <p className="text-muted-foreground mt-1 mb-4">Create your first purchase order to get started.</p>
              <Button onClick={() => setLocation("/procurement/new")} variant="outline">Create Order</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map(order => (
                    <TableRow key={order.id} className="cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setLocation(`/procurement/${order.id}`)}>
                      <TableCell className="font-medium font-mono text-sm">{order.poNumber}</TableCell>
                      <TableCell>{order.vendorName}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status] || ""}`}>
                          {order.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">${order.totalAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(order.dueDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(order.createdAt), "MMM d")}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setLocation(`/procurement/${order.id}`)}>View</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/procurement/${order.id}/edit`)}>Edit</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
