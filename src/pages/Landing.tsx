import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Video, Wand2, Mic, Layout, Zap, ArrowRight, CheckCircle2, Star } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const features = [
  {
    icon: Video,
    title: "Generazione Video AI",
    description: "Crea video professionali da testo o immagini con i migliori modelli AI sul mercato.",
  },
  {
    icon: Layout,
    title: "Storyboard Intelligenti",
    description: "Organizza le tue scene con storyboard interattivi e converti in video con un click.",
  },
  {
    icon: Wand2,
    title: "Editing Avanzato",
    description: "Timeline editor, transizioni, effetti e sottotitoli automatici per un risultato professionale.",
  },
  {
    icon: Mic,
    title: "Audio & Voiceover",
    description: "Clonazione vocale, text-to-speech, musica AI e mixing audio integrato.",
  },
];

const plans = [
  {
    name: "Free",
    price: "€0",
    period: "/mese",
    features: ["5 generazioni video/mese", "Risoluzione 720p", "1 progetto storyboard", "Supporto community"],
    cta: "Inizia Gratis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "€29",
    period: "/mese",
    features: ["50 generazioni video/mese", "Risoluzione Full HD", "Storyboard illimitati", "Clonazione vocale", "Timeline editor", "Supporto prioritario"],
    cta: "Prova Pro",
    highlighted: true,
  },
  {
    name: "Business",
    price: "€79",
    period: "/mese",
    features: ["200 generazioni video/mese", "Risoluzione 4K", "Tutto di Pro +", "API access", "Multi-provider", "Account manager dedicato"],
    cta: "Contattaci",
    highlighted: false,
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[hsl(220,26%,7%)] text-[hsl(210,40%,98%)] overflow-hidden">
      {/* Floating orbs background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-[hsl(217,91%,60%/0.12)] blur-[120px] animate-float" />
        <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[hsl(270,60%,55%/0.10)] blur-[140px] animate-float" style={{ animationDelay: "3s" }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[500px] h-[500px] rounded-full bg-[hsl(25,95%,63%/0.08)] blur-[120px] animate-float" style={{ animationDelay: "5s" }} />
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-50 border-b border-[hsl(224,30%,18%)] bg-[hsl(220,26%,7%/0.8)] backdrop-blur-xl sticky top-0"
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] bg-clip-text text-transparent">
              AI Production Hub
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")} className="text-[hsl(215,20%,65%)] hover:text-[hsl(210,40%,98%)] hover:bg-[hsl(224,30%,15%)]">
              Accedi
            </Button>
            <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] text-white border-0 hover:opacity-90 shadow-[0_0_20px_hsl(217,91%,60%/0.3)]">
              Registrati
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative z-10 py-24 md:py-36">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[hsl(217,91%,60%/0.3)] bg-[hsl(217,91%,60%/0.08)] text-[hsl(217,91%,75%)] text-sm font-medium mb-8 backdrop-blur-sm">
              <Zap className="w-4 h-4" />
              La piattaforma AI per la produzione video
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
              Crea Video Professionali{" "}
              <span className="bg-gradient-to-r from-[hsl(217,91%,60%)] via-[hsl(270,60%,55%)] to-[hsl(25,95%,63%)] bg-clip-text text-transparent">
                con l'Intelligenza Artificiale
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-[hsl(215,20%,65%)] mb-10 max-w-2xl mx-auto leading-relaxed">
              Genera, edita e produci video straordinari utilizzando i migliori modelli AI.
              Dalla sceneggiatura al video finale, tutto in un'unica piattaforma.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="text-lg px-8 bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] text-white border-0 hover:opacity-90 shadow-[0_0_30px_hsl(217,91%,60%/0.4)] transition-all duration-300"
              >
                Inizia Gratuitamente
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                className="text-lg px-8 border-[hsl(224,30%,22%)] bg-[hsl(224,30%,10%/0.5)] text-[hsl(210,40%,98%)] hover:bg-[hsl(224,30%,15%)] hover:border-[hsl(217,91%,60%/0.4)] backdrop-blur-sm transition-all duration-300"
              >
                Scopri le Funzionalità
              </Button>
            </motion.div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
            className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto"
          >
            {[
              { value: "1080p", label: "Ultra HD" },
              { value: "10+", label: "Modelli AI" },
              { value: "4-8s", label: "Video Generation" },
            ].map((stat, i) => (
              <motion.div key={stat.label} variants={fadeUp} custom={i} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(217,91%,60%/0.1)] to-[hsl(270,60%,55%/0.05)] rounded-xl blur-sm group-hover:blur-none transition-all duration-300" />
                <div className="relative p-6 rounded-xl border border-[hsl(224,30%,18%)] bg-[hsl(224,30%,10%/0.6)] backdrop-blur-sm group-hover:border-[hsl(217,91%,60%/0.3)] transition-all duration-300">
                  <div className="text-3xl font-bold bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] bg-clip-text text-transparent mb-1">{stat.value}</div>
                  <div className="text-sm text-[hsl(215,20%,65%)]">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-24 border-t border-[hsl(224,30%,14%)]">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">
              Tutto ciò che ti serve per{" "}
              <span className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] bg-clip-text text-transparent">produrre video AI</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-[hsl(215,20%,65%)] text-lg max-w-2xl mx-auto">
              Una suite completa di strumenti AI per ogni fase della produzione video.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                custom={i}
                className="group relative rounded-xl p-6 border border-[hsl(224,30%,18%)] bg-[hsl(224,30%,10%/0.4)] backdrop-blur-sm hover:border-[hsl(217,91%,60%/0.4)] hover:bg-[hsl(224,30%,12%/0.6)] transition-all duration-300"
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[hsl(217,91%,60%/0.05)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[hsl(217,91%,60%/0.2)] to-[hsl(270,60%,55%/0.1)] flex items-center justify-center mb-4 group-hover:shadow-[0_0_20px_hsl(217,91%,60%/0.2)] transition-all duration-300">
                    <feature.icon className="w-6 h-6 text-[hsl(217,91%,70%)]" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-[hsl(215,20%,65%)] text-sm leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 py-24 border-t border-[hsl(224,30%,14%)]">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">Piani e Prezzi</motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-[hsl(215,20%,65%)] text-lg">Scegli il piano più adatto alle tue esigenze</motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          >
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                custom={i}
                className={`relative rounded-xl p-8 border transition-all duration-300 ${
                  plan.highlighted
                    ? "border-[hsl(217,91%,60%/0.5)] bg-gradient-to-b from-[hsl(217,91%,60%/0.08)] to-[hsl(224,30%,10%/0.8)] shadow-[0_0_40px_hsl(217,91%,60%/0.15)] scale-105"
                    : "border-[hsl(224,30%,18%)] bg-[hsl(224,30%,10%/0.4)] hover:border-[hsl(224,30%,25%)]"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] text-xs font-semibold text-white flex items-center gap-1">
                    <Star className="w-3 h-3" /> Più Popolare
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-[hsl(215,20%,65%)]">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[hsl(215,20%,75%)]">
                      <CheckCircle2 className="w-4 h-4 text-[hsl(217,91%,60%)] shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] text-white border-0 hover:opacity-90 shadow-[0_0_20px_hsl(217,91%,60%/0.3)]"
                      : "border-[hsl(224,30%,22%)] bg-[hsl(224,30%,12%)] text-[hsl(210,40%,98%)] hover:bg-[hsl(224,30%,18%)] hover:border-[hsl(217,91%,60%/0.3)]"
                  }`}
                  variant={plan.highlighted ? "default" : "outline"}
                  onClick={() => navigate("/auth")}
                >
                  {plan.cta}
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative z-10 border-t border-[hsl(224,30%,14%)] py-10"
      >
        <div className="container mx-auto px-4 text-center text-sm text-[hsl(215,20%,50%)]">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] bg-clip-text text-transparent">
              AI Production Hub
            </span>
          </div>
          <p>© {new Date().getFullYear()} AI Production Hub. Tutti i diritti riservati.</p>
        </div>
      </motion.footer>
    </div>
  );
}
