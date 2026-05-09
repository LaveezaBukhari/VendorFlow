import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateInventoryItem, getListInventoryQueryKey, useListVendors } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const schema = z.object({
  sku: z.string().min(1, "SKU required"),
  name: z.string().min(1, "Name required"),
  description: z.string().default(""),
  quantity: z.coerce.number().min(0),
  reorderLevel: z.coerce.number().min(0),
  warehouseLocation: z.string().min(1, "Location required"),
  unitCost: z.coerce.number().min(0),
  category: z.string().min(1, "Category required"),
  vendorId: z.coerce.number().int().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function InventoryNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createItem = useCreateInventoryItem();
  const { data: vendors } = useListVendors();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { sku: "", name: "", description: "", quantity: 0, reorderLevel: 10, warehouseLocation: "", unitCost: 0, category: "", vendorId: null },
  });

  const onSubmit = (values: FormValues) => {
    createItem.mutate({ data: { ...values, vendorId: values.vendorId || null } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
        toast({ title: "Item created" });
        setLocation("/inventory");
      },
      onError: () => toast({ title: "Failed to create item", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/inventory")}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Inventory Item</h1>
          <p className="text-muted-foreground">Add stock to your warehouse.</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Item Details</CardTitle><CardDescription>Fill in stock and location information.</CardDescription></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="sku" render={({ field }) => (
                  <FormItem><FormLabel>SKU</FormLabel><FormControl><Input placeholder="SKU-001" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Item name" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel><FormControl><Input placeholder="Electronics, Supplies..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="warehouseLocation" render={({ field }) => (
                  <FormItem><FormLabel>Warehouse Location</FormLabel><FormControl><Input placeholder="A-101" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem><FormLabel>Current Quantity</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
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
                      <FormControl><SelectTrigger><SelectValue placeholder="No vendor" /></SelectTrigger></FormControl>
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
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Item description..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={createItem.isPending}>{createItem.isPending ? "Creating..." : "Create Item"}</Button>
                <Button variant="outline" type="button" onClick={() => setLocation("/inventory")}>Cancel</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
