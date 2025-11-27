import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Parameter = {
  name: string;
  description: string;
};

type Template = {
  id: string;
  name: string;
  description: string;
  prompt_template: string;
  parameters: Parameter[];
};

type ApplyTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  onApply: (filledPrompt: string) => void;
};

export const ApplyTemplateDialog = ({
  open,
  onOpenChange,
  template,
  onApply,
}: ApplyTemplateDialogProps) => {
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (template) {
      const initialValues: Record<string, string> = {};
      template.parameters.forEach((param) => {
        initialValues[param.name] = "";
      });
      setParamValues(initialValues);
    }
  }, [template]);

  const handleApply = () => {
    if (!template) return;

    // Check if all parameters are filled
    const emptyParams = template.parameters.filter(
      (param) => !paramValues[param.name]?.trim()
    );

    if (emptyParams.length > 0) {
      toast.error("Compila tutti i parametri");
      return;
    }

    // Replace parameters in template
    let filledPrompt = template.prompt_template;
    Object.entries(paramValues).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      filledPrompt = filledPrompt.replace(regex, value);
    });

    onApply(filledPrompt);
    onOpenChange(false);
    toast.success("Template applicato!");
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {template.parameters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Questo template non ha parametri configurabili
            </p>
          ) : (
            template.parameters.map((param) => (
              <div key={param.name} className="space-y-2">
                <Label htmlFor={param.name}>
                  {param.name}
                  {param.description && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({param.description})
                    </span>
                  )}
                </Label>
                <Input
                  id={param.name}
                  placeholder={`Inserisci ${param.name}...`}
                  value={paramValues[param.name] || ""}
                  onChange={(e) =>
                    setParamValues({ ...paramValues, [param.name]: e.target.value })
                  }
                />
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleApply}>Applica Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
