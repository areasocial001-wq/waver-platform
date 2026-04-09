import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const faqs = [
  {
    question: "Quali modelli AI sono supportati?",
    answer:
      "AI Production Hub integra oltre 30 modelli, tra cui Luma Ray 2, Luma Photon, Runway Gen-4, Kling V2.6, Google Veo, Sora, MiniMax, PixVerse, Wan 2.5, ElevenLabs per audio e molti altri. Puoi passare da un provider all'altro con un clic.",
  },
  {
    question: "In cosa si differenzia il piano Free dal Pro?",
    answer:
      "Il piano Free include 5 generazioni video al mese in 720p, generazione immagini AI e 1 progetto storyboard. Il piano Premium offre 50 generazioni video, immagini illimitate, Full HD, 10 storyboard, clonazione vocale, timeline editor e accesso API a €19,90/mese (o €15,90/mese annuale). Il piano Business a €79,90/mese (€63,90/mese annuale) include generazioni illimitate e risoluzione 4K.",
  },
  {
    question: "Posso generare video senza mostrare il volto (faceless)?",
    answer:
      "Sì! Il Faceless Video Generator crea video completi partendo da un semplice argomento: genera lo script con AI, seleziona le scene B-roll e le concatena automaticamente con voiceover e musica.",
  },
  {
    question: "Come funziona il Trailer Generator?",
    answer:
      "Inserisci un concept o una breve descrizione e il Trailer Generator crea un trailer cinematografico completo: genera le scene con modelli video AI, aggiunge musica e transizioni professionali.",
  },
  {
    question: "Quali risoluzioni sono supportate?",
    answer:
      "Supportiamo 720p, 1080p (Full HD) e 4K a seconda del modello e del piano. Luma Ray 2 e alcuni altri modelli offrono output fino a 4K con aspect ratio personalizzabili (16:9, 9:16, 1:1, 4:3).",
  },
  {
    question: "Posso clonare la mia voce?",
    answer:
      "Sì, con il piano Pro e superiori puoi clonare la tua voce tramite ElevenLabs. Basta caricare un campione audio e la voce clonata sarà disponibile per tutti i tuoi progetti video.",
  },
  {
    question: "I video generati hanno watermark?",
    answer:
      "I video generati con il piano Pro e Business non hanno watermark. Il piano Free può includere un watermark leggero a seconda del provider utilizzato.",
  },
  {
    question: "Posso accedere alle API per integrazioni custom?",
    answer:
      "Sì, il piano Business include accesso API completo per integrare la generazione video e immagini nei tuoi workflow e applicazioni esistenti.",
  },
];

export function LandingFAQ() {
  return (
    <section className="relative z-10 py-24 border-t border-[hsl(224,30%,12%)]">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center mb-14"
        >
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-3xl md:text-5xl font-bold mb-4"
          >
            Domande{" "}
            <span className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] bg-clip-text text-transparent">
              Frequenti
            </span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            className="text-[hsl(215,20%,60%)] text-lg"
          >
            Tutto ciò che devi sapere su AI Production Hub
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="rounded-xl border border-[hsl(224,30%,15%)] bg-[hsl(225,25%,8%/0.6)] backdrop-blur-sm px-6 data-[state=open]:border-[hsl(217,91%,60%/0.3)] transition-colors"
              >
                <AccordionTrigger className="text-left text-sm md:text-base font-medium hover:text-[hsl(217,91%,70%)] transition-colors py-5 [&[data-state=open]]:text-[hsl(217,91%,70%)]">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-[hsl(215,20%,60%)] text-sm leading-relaxed pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
