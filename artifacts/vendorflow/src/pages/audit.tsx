import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { History } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  created: "bg-emerald-100 text-emerald-700",
  updated: "bg-blue-100 text-blue-700",
  deleted: "bg-red-100 text-red-700",
};

export default function AuditLogs() {
  const { data: logs, isLoading } = useListAuditLogs();

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">Complete history of all system changes.</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
          <CardDescription>{logs?.length || 0} recorded events</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading audit logs...</div>
          ) : !logs?.length ? (
            <div className="p-12 text-center flex flex-col items-center">
              <History className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">No activity yet</h3>
              <p className="text-muted-foreground mt-1">Actions will appear here as you use the system.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Changes</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id} className="hover:bg-slate-50">
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.timestamp), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium">{log.userName}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-700"}`}>
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{log.entityType}</span>
                          <span className="text-muted-foreground ml-1">#{log.entityId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {Object.keys(log.changes || {}).join(", ")}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.ipAddress || "—"}
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
