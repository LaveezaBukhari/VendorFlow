import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetInventoryItem, getGetInventoryItemQueryKey, useUpdateInventoryItem, getListInventoryQueryKey, useListVendors } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const schema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  quantity: z.coerce.number().min(0),
  reorderLevel: z.coerce.number().min(0),
  warehouseLocation: z.string().min(1),
  unitCost: z.coerce.number().min(0),
  category: z.string().min(1),
  vendorId: z.coerce.number().int().nullable().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function InventoryEdit() {
  const { id } = useParams<{ id: string }>();
  const itemId = parseInt(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: item } = useGetInventoryItem(itemId, { query: { enabled: !!itemId, queryKey: getGetInventoryItemQueryKey(itemId) } });
  const updateItem = useUpdateInventoryItem();
  const { data: vendors } = useListVendors();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { sku: "", name: "", description: "", quantity: 0, reorderLevel: 10, warehouseLocation: "", unitCost: 0, category: "", vendorId: null },
  });

  useEffect(() => {
    if (item) form.reset({ ...item, vendorId: item.vendorId ?? null });
  }, [item]);

  const onSubmit = (values: FormValues) => {
    updateItem.mutate({ id: itemId, data: { ...values, vendorId: values.vendorId || null } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetInventoryItemQueryKey(itemId) });
        toast({ title: "Item updated" });
        setLocation(`/inventory/${itemId}`);
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/inventory/${itemId}`)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h1 className="text-3xl font-bold tracking-tight">Edit Item</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Item Details</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="sku" render={({ field }) => (
                  <FormItem><FormLabel>SKU</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="warehouseLocation" render={({ field }) => (
                  <FormItem><FormLabel>Warehouse Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="reorderLevel" render={({ field }) => (
                  <FormItem><FormLabel>Reorder Level</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="unitCost" render={({ field }) => (
                  <FormItem><FormLabel>Unit Cost ($)</FormLabel><FormControl><Input type="number" min={0} step={0.01} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="vendorId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor (Optional)</FormLabel>
                    <Select onValueChange={v => field.onChange(v === "none" ? null : Number(v))} value={field.value ? String(field.value) : "none"}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">No vendor</SelectItem>
                        {vendors?.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={updateItem.isPending}>{updateItem.isPending ? "Saving..." : "Save Changes"}</Button>
                <Button variant="outline" type="button" onClick={() => setLocation(`/inventory/${itemId}`)}>Cancel</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
