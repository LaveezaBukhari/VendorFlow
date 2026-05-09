import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetPurchaseOrder, getGetPurchaseOrderQueryKey, useUpdatePurchaseOrder, getListPurchaseOrdersQueryKey, useListVendors } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().positive(),
  category: z.string().min(1),
});

const schema = z.object({
  vendorId: z.coerce.number().int().positive(),
  dueDate: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

export default function ProcurementEdit() {
  const { id } = useParams<{ id: string }>();
  const poId = parseInt(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: order } = useGetPurchaseOrder(poId, { query: { enabled: !!poId, queryKey: getGetPurchaseOrderQueryKey(poId) } });
  const updatePO = useUpdatePurchaseOrder();
  const { data: vendors } = useListVendors();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { vendorId: 0, dueDate: "", notes: "", items: [{ description: "", quantity: 1, unitPrice: 0, category: "" }] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const watchItems = form.watch("items");

  useEffect(() => {
    if (order) {
      form.reset({
        vendorId: order.vendorId,
        dueDate: format(new Date(order.dueDate), "yyyy-MM-dd"),
        notes: order.notes ?? "",
        items: (order.items || []).map((i: any) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          category: i.category,
        })),
      });
    }
  }, [order]);

  const total = watchItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);

  const onSubmit = (values: FormValues) => {
    updatePO.mutate({ id: poId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPurchaseOrderQueryKey(poId) });
        toast({ title: "Purchase order updated" });
        setLocation(`/procurement/${poId}`);
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/procurement/${poId}`)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h1 className="text-3xl font-bold tracking-tight">Edit Purchase Order</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="vendorId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor</FormLabel>
                  <Select onValueChange={v => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {vendors?.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Line Items</CardTitle></div>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: 1, unitPrice: 0, category: "" })}>
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-32">Unit Price</TableHead>
                    <TableHead className="w-32">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (
                          <FormItem><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </TableCell>
                      <TableCell>
                        <FormField control={form.control} name={`items.${index}.category`} render={({ field }) => (
                          <FormItem><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </TableCell>
                      <TableCell>
                        <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                          <FormItem><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </TableCell>
                      <TableCell>
                        <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field }) => (
                          <FormItem><FormControl><Input type="number" min={0} step={0.01} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </TableCell>
                      <TableCell className="font-medium">
                        ${((Number(watchItems[index]?.quantity) || 0) * (Number(watchItems[index]?.unitPrice) || 0)).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {fields.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end p-4 border-t">
                <div className="text-right">
                  <span className="text-muted-foreground mr-4">Total</span>
                  <span className="text-2xl font-bold">${total.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={updatePO.isPending}>{updatePO.isPending ? "Saving..." : "Save Changes"}</Button>
            <Button variant="outline" type="button" onClick={() => setLocation(`/procurement/${poId}`)}>Cancel</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
