import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetVendor, getGetVendorQueryKey, useUpdateVendor, getListVendorsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.string().min(1),
  category: z.string().min(1),
  rating: z.coerce.number().min(0).max(5),
  status: z.enum(["active", "inactive", "suspended"]),
});

type FormValues = z.infer<typeof schema>;

export default function VendorEdit() {
  const { id } = useParams<{ id: string }>();
  const vendorId = parseInt(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vendor } = useGetVendor(vendorId, {
    query: { enabled: !!vendorId, queryKey: getGetVendorQueryKey(vendorId) },
  });
  const updateVendor = useUpdateVendor();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", address: "", category: "", rating: 4.5, status: "active" },
  });

  useEffect(() => {
    if (vendor) {
      form.reset({
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        category: vendor.category,
        rating: vendor.rating,
        status: vendor.status as any,
      });
    }
  }, [vendor]);

  const onSubmit = (values: FormValues) => {
    updateVendor.mutate({ id: vendorId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
        toast({ title: "Vendor updated" });
        setLocation(`/vendors/${vendorId}`);
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/vendors/${vendorId}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Edit Vendor</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Vendor Details</CardTitle><CardDescription>Update supplier information.</CardDescription></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="rating" render={({ field }) => (
                  <FormItem><FormLabel>Rating (0-5)</FormLabel><FormControl><Input type="number" min={0} max={5} step={0.1} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={updateVendor.isPending}>{updateVendor.isPending ? "Saving..." : "Save Changes"}</Button>
                <Button variant="outline" type="button" onClick={() => setLocation(`/vendors/${vendorId}`)}>Cancel</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
