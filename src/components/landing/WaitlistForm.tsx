import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, CheckCircle2 } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Inserisci un'email valida");
      return;
    }
    if (name.trim().length > 100) {
      toast.error("Il nome è troppo lungo (max 100 caratteri)");
      return;
    }
    if (message.trim().length > 500) {
      toast.error("Il messaggio è troppo lungo (max 500 caratteri)");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("waitlist").insert({
        email: trimmedEmail,
        name: name.trim() || null,
        message: message.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("Questa email è già nella waitlist!");
        } else {
          throw error;
        }
      } else {
        setIsSubmitted(true);
        toast.success("Iscrizione completata!");
        // Send notification to admins via edge function
        supabase.functions.invoke("waitlist-notification", {
          body: { email: trimmedEmail, name: name.trim() || null, message: message.trim() || null },
        }).catch((err) => console.error("Notification error:", err));
      }
    } catch (err) {
      console.error("Waitlist error:", err);
      toast.error("Errore durante l'iscrizione. Riprova.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <section className="relative z-10 py-24 border-t border-[hsl(224,30%,12%)]">
        <div className="container mx-auto px-4 max-w-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center rounded-2xl border border-[hsl(142,71%,45%/0.3)] bg-[hsl(142,71%,45%/0.06)] p-12"
          >
            <CheckCircle2 className="w-16 h-16 text-[hsl(142,71%,50%)] mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Sei nella lista! 🎉</h3>
            <p className="text-[hsl(215,20%,60%)]">
              Ti contatteremo quando ci saranno novità. Grazie per l'interesse!
            </p>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative z-10 py-24 border-t border-[hsl(224,30%,12%)]">
      <div className="container mx-auto px-4 max-w-2xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center mb-10"
        >
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-3xl md:text-5xl font-bold mb-4"
          >
            Unisciti alla{" "}
            <span className="bg-gradient-to-r from-[hsl(25,95%,63%)] to-[hsl(0,84%,60%)] bg-clip-text text-transparent">
              Waitlist
            </span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            className="text-[hsl(215,20%,60%)] text-lg"
          >
            Iscriviti per ricevere aggiornamenti, accesso anticipato e offerte esclusive
          </motion.p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[hsl(224,30%,15%)] bg-[hsl(225,25%,8%/0.6)] backdrop-blur-sm p-8 space-y-5"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[hsl(215,20%,55%)] mb-1.5 block">Nome (opzionale)</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Il tuo nome"
                maxLength={100}
                className="bg-[hsl(225,25%,10%)] border-[hsl(224,30%,18%)] text-white placeholder:text-[hsl(215,20%,35%)] focus-visible:ring-[hsl(217,91%,60%/0.5)]"
              />
            </div>
            <div>
              <label className="text-xs text-[hsl(215,20%,55%)] mb-1.5 block">
                Email <span className="text-[hsl(0,84%,60%)]">*</span>
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="la-tua@email.com"
                maxLength={255}
                className="bg-[hsl(225,25%,10%)] border-[hsl(224,30%,18%)] text-white placeholder:text-[hsl(215,20%,35%)] focus-visible:ring-[hsl(217,91%,60%/0.5)]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[hsl(215,20%,55%)] mb-1.5 block">Messaggio (opzionale)</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Come vorresti usare AI Production Hub?"
              maxLength={500}
              rows={3}
              className="bg-[hsl(225,25%,10%)] border-[hsl(224,30%,18%)] text-white placeholder:text-[hsl(215,20%,35%)] focus-visible:ring-[hsl(217,91%,60%/0.5)] resize-none"
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] text-white border-0 hover:opacity-90 shadow-[0_0_20px_hsl(217,91%,60%/0.3)] rounded-xl py-5 text-base font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Invio in corso...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Iscriviti alla Waitlist
              </>
            )}
          </Button>
          <p className="text-center text-[10px] text-[hsl(215,20%,40%)]">
            Niente spam. Solo aggiornamenti importanti.
          </p>
        </motion.form>
      </div>
    </section>
  );
}
