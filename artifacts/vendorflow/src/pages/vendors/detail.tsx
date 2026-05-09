import { useLocation, useParams } from "wouter";
import { useGetVendor, getGetVendorQueryKey, useDeleteVendor, getListVendorsQueryKey, useListPurchaseOrders } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit, Trash2, Mail, Phone, MapPin, Star } from "lucide-react";
import { format } from "date-fns";

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const vendorId = parseInt(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vendor, isLoading } = useGetVendor(vendorId, {
    query: { enabled: !!vendorId, queryKey: getGetVendorQueryKey(vendorId) },
  });
  const { data: allOrders } = useListPurchaseOrders();
  const deleteVendor = useDeleteVendor();

  const vendorOrders = allOrders?.filter(o => o.vendorId === vendorId) || [];

  const handleDelete = () => {
    if (!confirm("Delete this vendor?")) return;
    deleteVendor.mutate({ id: vendorId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        toast({ title: "Vendor deleted" });
        setLocation("/vendors");
      },
    });
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!vendor) return <div className="p-8 text-muted-foreground">Vendor not found</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/vendors")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{vendor.name}</h1>
            <p className="text-muted-foreground">{vendor.category}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation(`/vendors/${vendorId}/edit`)}>
            <Edit className="w-4 h-4 mr-1" /> Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Contact Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <a href={`mailto:${vendor.email}`} className="hover:underline">{vendor.email}</a>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{vendor.phone}</span>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <span>{vendor.address}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>{vendor.rating} / 5.0 rating</span>
            </div>
            <div className="pt-2">
              <Badge variant={vendor.status === "active" ? "default" : "destructive"}
                className={vendor.status === "active" ? "bg-emerald-500/10 text-emerald-700" : ""}>
                {vendor.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Spending Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-2xl font-bold">${vendor.totalSpent.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Spent</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-2xl font-bold">{vendorOrders.length}</div>
                <div className="text-sm text-muted-foreground">Purchase Orders</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-2xl font-bold">
                  {format(new Date(vendor.createdAt), "MMM yyyy")}
                </div>
                <div className="text-sm text-muted-foreground">Member Since</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Purchase Orders</CardTitle></CardHeader>
        <CardContent className="p-0">
          {vendorOrders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No purchase orders for this vendor</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorOrders.map(order => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setLocation(`/procurement/${order.id}`)}>
                    <TableCell className="font-medium">{order.poNumber}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{order.status}</Badge></TableCell>
                    <TableCell>${order.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(order.dueDate), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
