import { useState, useRef, DragEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Users, Plus, X, Upload, Trash2, Edit2, Check, Image as ImageIcon, GripVertical } from "lucide-react";
import { StoryboardCharacter } from "@/hooks/useStoryboardCharacters";
import { toast } from "sonner";

const CHARACTER_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
];

interface CharacterLockPanelProps {
  characters: StoryboardCharacter[];
  onAddCharacter: (name: string, description?: string, color?: string) => Promise<StoryboardCharacter | null>;
  onUpdateCharacter: (id: string, updates: Partial<Pick<StoryboardCharacter, "name" | "description" | "color" | "reference_images">>) => Promise<void>;
  onDeleteCharacter: (id: string) => Promise<void>;
  onAddReferenceImage: (characterId: string, imageUrl: string) => Promise<void>;
  onRemoveReferenceImage: (characterId: string, imageIndex: number) => Promise<void>;
  panelCharacters?: Record<string, string[]>; // panelId -> characterIds
  onAssignCharacter?: (panelId: string, characterId: string) => void;
  onUnassignCharacter?: (panelId: string, characterId: string) => void;
  disabled?: boolean;
}

export const CharacterLockPanel = ({
  characters,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  onAddReferenceImage,
  onRemoveReferenceImage,
  disabled,
}: CharacterLockPanelProps) => {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(CHARACTER_COLORS[0]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dragOverCharId, setDragOverCharId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const result = await onAddCharacter(newName.trim(), newDescription.trim() || undefined, selectedColor);
    if (result) {
      setNewName("");
      setNewDescription("");
      setSelectedColor(CHARACTER_COLORS[Math.floor(Math.random() * CHARACTER_COLORS.length)]);
      setAddDialogOpen(false);
    }
  };

  const handleFileUpload = (characterId: string, file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      onAddReferenceImage(characterId, url);
    };
    reader.readAsDataURL(file);
  };

  const handleDropImage = (e: DragEvent, characterId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCharId(null);

    // Check for image URL from gallery drag
    const imageUrl = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text/uri-list");
    if (imageUrl && (imageUrl.startsWith("data:") || imageUrl.startsWith("http") || imageUrl.startsWith("blob:"))) {
      const char = characters.find(c => c.id === characterId);
      if (char && char.reference_images.length >= 5) {
        toast.error("Massimo 5 immagini di riferimento per personaggio");
        return;
      }
      onAddReferenceImage(characterId, imageUrl);
      toast.success("Immagine di riferimento aggiunta tramite drag & drop!");
      return;
    }

    // Check for file drop
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const char = characters.find(c => c.id === characterId);
      if (char && char.reference_images.length >= 5) {
        toast.error("Massimo 5 immagini di riferimento per personaggio");
        return;
      }
      handleFileUpload(characterId, file);
      toast.success("Immagine di riferimento aggiunta!");
    }
  };

  const handleDragOver = (e: DragEvent, characterId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCharId(characterId);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragOverCharId(null);
  };

  const handleStartEdit = (char: StoryboardCharacter) => {
    setEditingId(char.id);
    setEditName(char.name);
  };

  const handleSaveEdit = async (id: string) => {
    if (editName.trim()) {
      await onUpdateCharacter(id, { name: editName.trim() });
    }
    setEditingId(null);
  };

  return (
    <Card className="p-4 bg-card/50 border-primary/20">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Character Lock</h3>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={disabled}>
                <Plus className="h-3 w-3 mr-1" />
                Aggiungi
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuovo Personaggio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="es. Protagonista, Detective, Robot..."
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrizione (opzionale)</Label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Descrizione fisica, abbigliamento, tratti distintivi..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Colore identificativo</Label>
                  <div className="flex gap-2 flex-wrap">
                    {CHARACTER_COLORS.map((color) => (
                      <button
                        key={color}
                        className={`w-7 h-7 rounded-full border-2 transition-transform ${
                          selectedColor === color ? "scale-125 border-foreground" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setSelectedColor(color)}
                      />
                    ))}
                  </div>
                </div>
                <Button onClick={handleAdd} disabled={!newName.trim()} className="w-full">
                  Crea Personaggio
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {characters.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Aggiungi personaggi per mantenere coerenza visiva tra le scene
          </p>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-3 pr-2">
              {characters.map((char) => (
                <Card
                  key={char.id}
                  className={`p-3 bg-background/50 border transition-all ${
                    dragOverCharId === char.id ? "ring-2 ring-primary bg-primary/5 scale-[1.02]" : ""
                  }`}
                  style={{ borderLeftColor: char.color, borderLeftWidth: 3 }}
                  onDrop={(e) => handleDropImage(e, char.id)}
                  onDragOver={(e) => handleDragOver(e, char.id)}
                  onDragLeave={handleDragLeave}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      {editingId === char.id ? (
                        <div className="flex items-center gap-1 flex-1 mr-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-7 text-xs"
                            onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(char.id)}
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSaveEdit(char.id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: char.color }} />
                          <span className="text-sm font-medium">{char.name}</span>
                        </div>
                      )}
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleStartEdit(char)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDeleteCharacter(char.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {char.description && (
                      <p className="text-xs text-muted-foreground">{char.description}</p>
                    )}

                    {/* Reference images */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Riferimenti ({char.reference_images.length}/5)
                        </span>
                        {char.reference_images.length < 5 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={() => fileInputRefs.current[char.id]?.click()}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Aggiungi
                          </Button>
                        )}
                        <input
                          ref={(el) => { fileInputRefs.current[char.id] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(char.id, file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                      {char.reference_images.length > 0 ? (
                        <div className="grid grid-cols-3 gap-1">
                          {char.reference_images.map((img, idx) => (
                            <div key={idx} className="relative group aspect-square rounded overflow-hidden">
                              <img src={img} alt={`Ref ${idx + 1}`} className="w-full h-full object-cover" />
                              <button
                                className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => onRemoveReferenceImage(char.id, idx)}
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-16 border border-dashed rounded text-muted-foreground hover:border-primary/50 transition-colors">
                          <GripVertical className="h-3.5 w-3.5 mb-0.5" />
                          <span className="text-[10px]">Trascina immagini qui</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        <Badge variant="outline" className="text-xs w-full justify-center">
          {characters.length} personagg{characters.length === 1 ? "io" : "i"} • {characters.reduce((sum, c) => sum + c.reference_images.length, 0)} riferimenti
        </Badge>
      </div>
    </Card>
  );
};
