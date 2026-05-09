import { useLocation, useParams } from "wouter";
import { useGetInventoryItem, getGetInventoryItemQueryKey, useDeleteInventoryItem, getListInventoryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function InventoryDetail() {
  const { id } = useParams<{ id: string }>();
  const itemId = parseInt(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: item, isLoading } = useGetInventoryItem(itemId, {
    query: { enabled: !!itemId, queryKey: getGetInventoryItemQueryKey(itemId) },
  });
  const deleteItem = useDeleteInventoryItem();

  const handleDelete = () => {
    if (!confirm("Delete this item?")) return;
    deleteItem.mutate({ id: itemId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
        toast({ title: "Item deleted" });
        setLocation("/inventory");
      },
    });
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!item) return <div className="p-8 text-muted-foreground">Item not found</div>;

  const isLow = item.quantity <= item.reorderLevel;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/inventory")}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
              {isLow && <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Low Stock</Badge>}
            </div>
            <p className="text-muted-foreground font-mono text-sm">{item.sku}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation(`/inventory/${itemId}/edit`)}><Edit className="w-4 h-4 mr-1" /> Edit</Button>
          <Button variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Stock Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Category" value={item.category} />
            <Row label="Warehouse Location" value={item.warehouseLocation} />
            <Row label="Current Quantity" value={<span className={isLow ? "text-destructive font-bold" : "font-bold"}>{item.quantity}</span>} />
            <Row label="Reorder Level" value={item.reorderLevel} />
            <Row label="Unit Cost" value={`$${item.unitCost}`} />
            <Row label="Total Value" value={`$${(item.quantity * item.unitCost).toLocaleString()}`} />
            {item.vendorName && <Row label="Vendor" value={item.vendorName} />}
            <Row label="Description" value={item.description || "-"} />
            <Row label="Added" value={format(new Date(item.createdAt), "MMM d, yyyy")} />
          </CardContent>
        </Card>

        <Card className={isLow ? "border-destructive/30 bg-destructive/5" : ""}>
          <CardHeader><CardTitle>{isLow ? "Stock Alert" : "Stock Status"}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-end gap-2">
                <span className={`text-5xl font-bold ${isLow ? "text-destructive" : ""}`}>{item.quantity}</span>
                <span className="text-muted-foreground mb-1">units in stock</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${isLow ? "bg-destructive" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, item.reorderLevel > 0 ? (item.quantity / (item.reorderLevel * 2)) * 100 : 100)}%` }}
                />
              </div>
              {isLow && <p className="text-sm text-destructive">Quantity is at or below reorder level of {item.reorderLevel} units. Consider placing a purchase order.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
