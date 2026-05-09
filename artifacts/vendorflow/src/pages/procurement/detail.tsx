import { useLocation, useParams } from "wouter";
import { useGetPurchaseOrder, getGetPurchaseOrderQueryKey, useUpdatePurchaseOrderStatus, useDeletePurchaseOrder, getListPurchaseOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit, Trash2, CheckCircle, XCircle, Send } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  received: "bg-purple-100 text-purple-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function ProcurementDetail() {
  const { id } = useParams<{ id: string }>();
  const poId = parseInt(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useGetPurchaseOrder(poId, {
    query: { enabled: !!poId, queryKey: getGetPurchaseOrderQueryKey(poId) },
  });
  const updateStatus = useUpdatePurchaseOrderStatus();
  const deletePO = useDeletePurchaseOrder();

  const handleStatus = (status: string) => {
    updateStatus.mutate({ id: poId, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPurchaseOrderQueryKey(poId) });
        queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        toast({ title: `Order ${status}` });
      },
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this purchase order?")) return;
    deletePO.mutate({ id: poId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        toast({ title: "Purchase order deleted" });
        setLocation("/procurement");
      },
    });
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!order) return <div className="p-8 text-muted-foreground">Order not found</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/procurement")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-mono">{order.poNumber}</h1>
            <p className="text-muted-foreground">{order.vendorName}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {order.status === "draft" && (
            <Button onClick={() => handleStatus("submitted")} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <Send className="w-4 h-4 mr-1" /> Submit for Approval
            </Button>
          )}
          {order.status === "submitted" && (
            <>
              <Button onClick={() => handleStatus("approved")} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="w-4 h-4 mr-1" /> Approve
              </Button>
              <Button onClick={() => handleStatus("rejected")} variant="destructive">
                <XCircle className="w-4 h-4 mr-1" /> Reject
              </Button>
            </>
          )}
          {order.status === "approved" && (
            <Button onClick={() => handleStatus("received")} variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
              <CheckCircle className="w-4 h-4 mr-1" /> Mark Received
            </Button>
          )}
          <Button variant="outline" onClick={() => setLocation(`/procurement/${poId}/edit`)}>
            <Edit className="w-4 h-4 mr-1" /> Edit
          </Button>
          <Button variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Order Info</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status] || ""}`}>{order.status}</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Vendor</span><span className="font-medium">{order.vendorName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span>{format(new Date(order.dueDate), "MMM d, yyyy")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{format(new Date(order.createdAt), "MMM d, yyyy")}</span></div>
            {order.notes && <div className="pt-2 border-t"><p className="text-muted-foreground text-xs mb-1">Notes</p><p>{order.notes}</p></div>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(order.items || []).map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.category}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">${item.unitPrice?.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">${item.total?.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/20 font-bold">
                  <TableCell colSpan={4} className="text-right">Total Amount</TableCell>
                  <TableCell className="text-right text-lg">${order.totalAmount.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
