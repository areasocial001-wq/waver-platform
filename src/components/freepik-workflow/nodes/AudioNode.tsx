import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music, Upload, X, Volume2 } from "lucide-react";
import { AudioNodeData } from "../types";

const AudioNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as AudioNodeData;
  const [isPlaying, setIsPlaying] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const event = new CustomEvent("nodeDataChange", {
          detail: {
            nodeId: id,
            data: {
              ...nodeData,
              audioUrl: reader.result as string,
              audioFileName: file.name,
              audioType: "file",
            },
          },
        });
        window.dispatchEvent(event);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChange = (field: string, value: any) => {
    const event = new CustomEvent("nodeDataChange", {
      detail: {
        nodeId: id,
        data: { ...nodeData, [field]: value },
      },
    });
    window.dispatchEvent(event);
  };

  const clearAudio = () => {
    const event = new CustomEvent("nodeDataChange", {
      detail: {
        nodeId: id,
        data: { ...nodeData, audioUrl: undefined, audioFileName: undefined },
      },
    });
    window.dispatchEvent(event);
  };

  const playPreview = () => {
    if (nodeData.audioUrl) {
      const audio = new Audio(nodeData.audioUrl);
      audio.play();
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
    }
  };

  return (
    <Card className="w-72 bg-orange-500/10 backdrop-blur border-orange-500/30 shadow-lg shadow-orange-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Music className="h-4 w-4 text-orange-500" />
          Audio / Musica
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Tipo Audio</Label>
          <Select
            value={nodeData.audioType || "generate"}
            onValueChange={(value) => handleChange("audioType", value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="generate">Genera con AI</SelectItem>
              <SelectItem value="file">Carica File</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {nodeData.audioType === "file" ? (
          <div className="space-y-2">
            {nodeData.audioUrl ? (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                <Volume2 className="h-4 w-4 text-orange-500" />
                <span className="flex-1 truncate">{nodeData.audioFileName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={playPreview}
                >
                  <Volume2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-destructive"
                  onClick={clearAudio}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-20 bg-muted/30 rounded-md border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Carica audio</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Prompt Audio</Label>
              <Textarea
                placeholder="Descrivi la musica o effetti sonori..."
                value={nodeData.prompt || ""}
                onChange={(e) => handleChange("prompt", e.target.value)}
                className="min-h-[60px] text-xs resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select
                value={nodeData.category || "music"}
                onValueChange={(value) => handleChange("category", value)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="music">Musica di sottofondo</SelectItem>
                  <SelectItem value="sfx">Effetti sonori</SelectItem>
                  <SelectItem value="ambient">Suoni ambientali</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Durata (sec)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={nodeData.duration || 10}
                onChange={(e) => handleChange("duration", parseInt(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Volume (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={nodeData.volume || 100}
            onChange={(e) => handleChange("volume", parseInt(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
      </CardContent>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-orange-500 border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-orange-500 border-2 border-background"
      />
    </Card>
  );
});

AudioNode.displayName = "AudioNode";

export default AudioNode;
