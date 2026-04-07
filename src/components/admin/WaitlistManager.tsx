import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Trash2, Mail, Download } from "lucide-react";

interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  message: string | null;
  created_at: string;
}

export function WaitlistManager() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("waitlist").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Errore: " + error.message);
    else setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("waitlist").delete().eq("id", id);
    if (error) toast.error("Errore: " + error.message);
    else { toast.success("Rimosso"); setEntries(prev => prev.filter(e => e.id !== id)); }
  };

  const exportCSV = () => {
    const header = "Email,Nome,Messaggio,Data\n";
    const rows = entries.map(e => `"${e.email}","${e.name || ""}","${(e.message || "").replace(/"/g, '""')}","${new Date(e.created_at).toLocaleDateString("it-IT")}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "waitlist.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Waitlist</CardTitle>
            <CardDescription>{entries.length} iscrizioni totali</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={entries.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Esporta CSV
            </Button>
            <Button variant="outline" size="sm" onClick={fetchEntries} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Aggiorna
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 && !loading ? (
          <p className="text-center text-muted-foreground py-8">Nessuna iscrizione alla waitlist</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Messaggio</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.email}</TableCell>
                  <TableCell>{e.name || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{e.message || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(e.created_at).toLocaleDateString("it-IT")}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Rimuovere {e.email}?</AlertDialogTitle>
                          <AlertDialogDescription>L'iscrizione verrà eliminata permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(e.id)} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
