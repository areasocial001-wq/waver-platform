import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Mic2, Plus, Trash2, Pencil, RefreshCw, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import { z } from "zod";

interface VoiceMapping {
  id: string;
  elevenlabs_voice_id: string;
  elevenlabs_voice_name: string;
  inworld_voice_name: string;
  notes: string | null;
  updated_at: string;
}

// Known Inworld voices (used for validation hint)
const KNOWN_INWORLD_VOICES = [
  "Sarah", "Roger", "Liam", "Ashley", "Alex", "Edward", "Olivia", "Mark",
  "Hades", "Theodore", "Pixie", "Wendy", "Dennis", "Timothy", "Ronald",
  "Deborah", "Craig", "Julia", "Priya",
] as const;

const mappingSchema = z.object({
  elevenlabs_voice_id: z
    .string()
    .trim()
    .min(8, "ID ElevenLabs troppo corto")
    .max(64, "ID ElevenLabs troppo lungo")
    .regex(/^[A-Za-z0-9_-]+$/, "Solo lettere, numeri, _ e -"),
  elevenlabs_voice_name: z
    .string()
    .trim()
    .min(1, "Nome obbligatorio")
    .max(60, "Nome troppo lungo"),
  inworld_voice_name: z
    .string()
    .trim()
    .min(2, "Nome voce Inworld obbligatorio")
    .max(40, "Nome troppo lungo")
    .regex(/^[A-Z][a-zA-Z]+$/, "Inworld richiede un nome capitalizzato (es. Sarah)"),
  notes: z.string().trim().max(280, "Note troppo lunghe").optional(),
});

type FormValues = z.infer<typeof mappingSchema>;

const emptyForm: FormValues = {
  elevenlabs_voice_id: "",
  elevenlabs_voice_name: "",
  inworld_voice_name: "",
  notes: "",
};

export function VoiceMappingsManager() {
  const [mappings, setMappings] = useState<VoiceMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VoiceMapping | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [saving, setSaving] = useState(false);

  const fetchMappings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("voice_mappings")
      .select("*")
      .order("elevenlabs_voice_name", { ascending: true });
    if (error) {
      toast.error("Errore nel caricamento mapping: " + error.message);
    } else {
      setMappings((data ?? []) as VoiceMapping[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (m: VoiceMapping) => {
    setEditing(m);
    setForm({
      elevenlabs_voice_id: m.elevenlabs_voice_id,
      elevenlabs_voice_name: m.elevenlabs_voice_name,
      inworld_voice_name: m.inworld_voice_name,
      notes: m.notes ?? "",
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const parsed = mappingSchema.safeParse(form);
    if (!parsed.success) {
      const next: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormValues;
        if (!next[k]) next[k] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        elevenlabs_voice_id: parsed.data.elevenlabs_voice_id,
        elevenlabs_voice_name: parsed.data.elevenlabs_voice_name,
        inworld_voice_name: parsed.data.inworld_voice_name,
        notes: parsed.data.notes || null,
      };

      if (editing) {
        const { error } = await supabase
          .from("voice_mappings")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Mapping aggiornato");
      } else {
        const { error } = await supabase.from("voice_mappings").insert(payload);
        if (error) throw error;
        toast.success("Mapping creato");
      }
      setDialogOpen(false);
      await fetchMappings();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("voice_mappings_elevenlabs_voice_id_key") || msg.includes("duplicate")) {
        toast.error("Esiste già un mapping per questo ID ElevenLabs");
      } else {
        toast.error("Errore salvataggio: " + msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("voice_mappings").delete().eq("id", id);
    if (error) {
      toast.error("Errore eliminazione: " + error.message);
      return;
    }
    toast.success("Mapping eliminato");
    await fetchMappings();
  };

  const filtered = mappings.filter((m) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      m.elevenlabs_voice_id.toLowerCase().includes(s) ||
      m.elevenlabs_voice_name.toLowerCase().includes(s) ||
      m.inworld_voice_name.toLowerCase().includes(s)
    );
  });

  const inworldKnown = (name: string) => KNOWN_INWORLD_VOICES.includes(name as any);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mic2 className="h-5 w-5" />
              Mapping Voci ElevenLabs ↔ Inworld
            </CardTitle>
            <CardDescription>
              Definisci a quale voce Inworld viene reindirizzata ogni voce ElevenLabs in caso di
              fallback automatico.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchMappings} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Aggiorna
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nuovo mapping
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editing ? "Modifica mapping" : "Nuovo mapping"}</DialogTitle>
                  <DialogDescription>
                    Collega un voice ID di ElevenLabs a una voce Inworld (es. <code>Sarah</code>,{" "}
                    <code>Liam</code>, <code>Roger</code>).
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="el-id">ElevenLabs Voice ID</Label>
                    <Input
                      id="el-id"
                      value={form.elevenlabs_voice_id}
                      onChange={(e) =>
                        setForm({ ...form, elevenlabs_voice_id: e.target.value })
                      }
                      placeholder="EXAVITQu4vr4xnSDxMaL"
                      disabled={!!editing}
                    />
                    {errors.elevenlabs_voice_id && (
                      <p className="text-xs text-destructive">{errors.elevenlabs_voice_id}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="el-name">Nome ElevenLabs</Label>
                    <Input
                      id="el-name"
                      value={form.elevenlabs_voice_name}
                      onChange={(e) =>
                        setForm({ ...form, elevenlabs_voice_name: e.target.value })
                      }
                      placeholder="Sarah"
                    />
                    {errors.elevenlabs_voice_name && (
                      <p className="text-xs text-destructive">{errors.elevenlabs_voice_name}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="iw-name">Voce Inworld</Label>
                    <Input
                      id="iw-name"
                      value={form.inworld_voice_name}
                      onChange={(e) =>
                        setForm({ ...form, inworld_voice_name: e.target.value })
                      }
                      placeholder="Sarah"
                      list="inworld-voices"
                    />
                    <datalist id="inworld-voices">
                      {KNOWN_INWORLD_VOICES.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                    {errors.inworld_voice_name && (
                      <p className="text-xs text-destructive">{errors.inworld_voice_name}</p>
                    )}
                    {form.inworld_voice_name && !errors.inworld_voice_name && (
                      <p className="text-xs flex items-center gap-1 text-muted-foreground">
                        {inworldKnown(form.inworld_voice_name) ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            Voce Inworld riconosciuta
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 text-muted-foreground" />
                            Voce non standard — verifica il nome su platform.inworld.ai
                          </>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Note (opzionale)</Label>
                    <Input
                      id="notes"
                      value={form.notes ?? ""}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="es. voce maschile matura"
                    />
                    {errors.notes && (
                      <p className="text-xs text-destructive">{errors.notes}</p>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                    Annulla
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Salvataggio..." : editing ? "Aggiorna" : "Crea"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-3 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per ID, nome ElevenLabs o nome Inworld..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ElevenLabs</TableHead>
                <TableHead>Voice ID</TableHead>
                <TableHead>Inworld</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Caricamento...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nessun mapping trovato
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.elevenlabs_voice_name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {m.elevenlabs_voice_id}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={inworldKnown(m.inworld_voice_name) ? "default" : "secondary"}
                      >
                        {m.inworld_voice_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">
                      {m.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminare il mapping?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Il mapping <strong>{m.elevenlabs_voice_name}</strong> →{" "}
                                <strong>{m.inworld_voice_name}</strong> verrà rimosso. In fallback
                                la voce userà il default Inworld (Sarah).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(m.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Totale: <strong>{mappings.length}</strong> mapping configurati
        </p>
      </CardContent>
    </Card>
  );
}
