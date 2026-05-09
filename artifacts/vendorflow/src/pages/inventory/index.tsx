import { useState } from "react";
import { useLocation } from "wouter";
import { useListInventory } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Package, MoreHorizontal, AlertTriangle } from "lucide-react";

export default function Inventory() {
  const { data: items, isLoading } = useListInventory();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [, setLocation] = useLocation();

  const categories = ["all", ...Array.from(new Set(items?.map(i => i.category) || []))];

  const filtered = items?.filter(item => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || item.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Track stock levels and warehouse locations.</p>
        </div>
        <Button onClick={() => setLocation("/inventory/new")} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name or SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-background"
            >
              {categories.map(c => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading inventory...</div>
          ) : !filtered?.length ? (
            <div className="p-12 text-center flex flex-col items-center">
              <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">No items found</h3>
              <Button onClick={() => setLocation("/inventory/new")} variant="outline" className="mt-4">Add Item</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Reorder At</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map(item => {
                    const isLow = item.quantity <= item.reorderLevel;
                    return (
                      <TableRow key={item.id}
                        className={`cursor-pointer transition-colors ${isLow ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-slate-50"}`}
                        onClick={() => setLocation(`/inventory/${item.id}`)}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{item.sku}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isLow && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
                            <span className={`font-medium ${isLow ? "text-destructive" : ""}`}>{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.warehouseLocation}</TableCell>
                        <TableCell className={`text-right font-medium ${isLow ? "text-destructive" : ""}`}>{item.quantity}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.reorderLevel}</TableCell>
                        <TableCell className="text-right">${item.unitCost}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setLocation(`/inventory/${item.id}`)}>View</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setLocation(`/inventory/${item.id}/edit`)}>Edit</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
