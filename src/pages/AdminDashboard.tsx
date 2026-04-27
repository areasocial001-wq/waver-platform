import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { AuthGuard } from "@/components/AuthGuard";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Shield, Users, BarChart3, Ban, Trash2, RefreshCw, Crown, Mail, Database, Mic2 } from "lucide-react";
import { WaitlistManager } from "@/components/admin/WaitlistManager";
import { DbHealthDashboard } from "@/components/admin/DbHealthDashboard";
import { KlingTimeoutsCard } from "@/components/admin/KlingTimeoutsCard";
import { VoiceMappingsManager } from "@/components/admin/VoiceMappingsManager";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
  profile: { is_blocked: boolean; full_name: string } | null;
}

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case "admin": return "destructive";
    case "premium": return "default";
    case "moderator": return "secondary";
    default: return "outline";
  }
};

export default function AdminDashboard() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/");
      toast.error("Accesso non autorizzato");
    }
  }, [isAdmin, roleLoading, navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "list_users" },
      });
      if (error) throw error;
      setUsers(data.users || []);
    } catch (err: any) {
      toast.error("Errore nel caricamento utenti: " + err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const handleAction = async (action: string, targetUserId: string, role?: string) => {
    setActionLoading(targetUserId);
    try {
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action, targetUserId, role },
      });
      if (error) throw error;
      toast.success("Operazione completata");
      await fetchUsers();
    } catch (err: any) {
      toast.error("Errore: " + err.message);
    }
    setActionLoading(null);
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const totalUsers = users.length;
  const blockedUsers = users.filter((u) => u.profile?.is_blocked).length;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-6xl py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              Dashboard Admin
            </h1>
            <p className="text-muted-foreground mt-2">
              Gestisci utenti, ruoli e monitora l'utilizzo della piattaforma
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Utenti Totali</CardDescription>
                <CardTitle className="text-3xl">{totalUsers}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Utenti Bloccati</CardDescription>
                <CardTitle className="text-3xl text-destructive">{blockedUsers}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="mb-6">
            <Button variant="outline" onClick={() => navigate("/admin/recovery-analytics")}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Recovery Analytics
            </Button>
          </div>

          <Tabs defaultValue="users" className="space-y-6">
            <TabsList>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Utenti
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Statistiche
              </TabsTrigger>
              <TabsTrigger value="waitlist" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Waitlist
              </TabsTrigger>
              <TabsTrigger value="db" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Database
              </TabsTrigger>
              <TabsTrigger value="voices" className="flex items-center gap-2">
                <Mic2 className="h-4 w-4" />
                Voci TTS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Gestione Utenti</CardTitle>
                      <CardDescription>Lista di tutti gli utenti registrati</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                      Aggiorna
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Ruoli</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Registrato</TableHead>
                        <TableHead>Ultimo accesso</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {u.roles.map((r) => (
                                <Badge key={r} variant={roleBadgeVariant(r) as any}>
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {u.profile?.is_blocked ? (
                              <Badge variant="destructive">Bloccato</Badge>
                            ) : (
                              <Badge variant="secondary">Attivo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString("it-IT")}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {u.last_sign_in_at
                              ? new Date(u.last_sign_in_at).toLocaleDateString("it-IT")
                              : "Mai"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Assign role */}
                              <Select
                                onValueChange={(role) => handleAction("assign_role", u.id, role)}
                                disabled={actionLoading === u.id}
                              >
                                <SelectTrigger className="w-[120px] h-8">
                                  <SelectValue placeholder="+ Ruolo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="premium">Premium</SelectItem>
                                  <SelectItem value="moderator">Moderator</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>

                              {/* Block/Unblock */}
                              {u.profile?.is_blocked ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAction("unblock_user", u.id)}
                                  disabled={actionLoading === u.id}
                                >
                                  Sblocca
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive"
                                  onClick={() => handleAction("block_user", u.id)}
                                  disabled={actionLoading === u.id}
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              )}

                              {/* Delete */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={actionLoading === u.id}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Eliminare questo utente?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      L'utente {u.email} verrà eliminato permanentemente con tutti i suoi dati. Questa azione non è reversibile.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleAction("delete_user", u.id)}
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
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5" />
                      Distribuzione Ruoli
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {["admin", "business", "creator", "premium", "moderator", "user"].map((role) => {
                        const count = users.filter((u) => u.roles.includes(role)).length;
                        const pct = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
                        return (
                          <div key={role} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant={roleBadgeVariant(role) as any}>{role}</Badge>
                              <span className="text-sm text-muted-foreground">{count} utenti</span>
                            </div>
                            <div className="w-32 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary rounded-full h-2 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Registrazioni Recenti
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {users
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 5)
                        .map((u) => (
                          <div key={u.id} className="flex items-center justify-between text-sm">
                            <span className="truncate max-w-[200px]">{u.email}</span>
                            <span className="text-muted-foreground">
                              {new Date(u.created_at).toLocaleDateString("it-IT")}
                            </span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="mt-4">
                <KlingTimeoutsCard />
              </div>
            </TabsContent>

            <TabsContent value="waitlist">
              <WaitlistManager />
            </TabsContent>

            <TabsContent value="costs">
              <CostMarginDashboard />
            </TabsContent>

            <TabsContent value="db">
              <DbHealthDashboard />
            </TabsContent>

            <TabsContent value="voices">
              <VoiceMappingsManager />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthGuard>
  );
}
