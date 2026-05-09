import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListVendors } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Vendors() {
  const { data: vendors, isLoading } = useListVendors();
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const filteredVendors = vendors?.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) || 
    v.category.toLowerCase().includes(search.toLowerCase()) ||
    v.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vendors</h1>
          <p className="text-muted-foreground">Manage supplier relationships and contact information.</p>
        </div>
        <Button onClick={() => setLocation("/vendors/new")} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Vendor
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-50/50"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading vendors...</div>
          ) : !vendors?.length ? (
            <div className="p-12 text-center flex flex-col items-center">
              <Building2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">No vendors found</h3>
              <p className="text-muted-foreground mt-1 mb-4">Get started by adding your first vendor.</p>
              <Button onClick={() => setLocation("/vendors/new")} variant="outline">Add Vendor</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="w-[300px]">Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors?.map((vendor) => (
                    <TableRow 
                      key={vendor.id} 
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setLocation(`/vendors/${vendor.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium text-slate-900">{vendor.name}</div>
                        <div className="text-sm text-muted-foreground">{vendor.email}</div>
                      </TableCell>
                      <TableCell>{vendor.category}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={vendor.status === "active" ? "default" : vendor.status === "suspended" ? "destructive" : "secondary"}
                          className={vendor.status === "active" ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20" : ""}
                        >
                          {vendor.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">${vendor.totalSpent.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(vendor.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setLocation(`/vendors/${vendor.id}`)}>
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/vendors/${vendor.id}/edit`)}>
                              Edit vendor
                            </DropdownMenuItem>
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
