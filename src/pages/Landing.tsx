import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Video, Wand2, Mic, Layout, Zap, ArrowRight, CheckCircle2, Star, Quote, Play, Image as ImageIcon, Film, Music, ChevronRight, BookOpen } from "lucide-react";
import heroBg from "@/assets/landing-hero-cinematic.jpg";
import studioBg from "@/assets/studio-bg.jpg";
import { motion, useScroll, useTransform, useInView, animate } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { LiveVideoCounter } from "@/components/landing/LiveVideoCounter";
import { VideoShowcaseCard } from "@/components/landing/VideoShowcaseCard";
import { LandingFAQ } from "@/components/landing/LandingFAQ";

import logoImg from "@/assets/logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const parallaxReveal = {
  hidden: { opacity: 0, y: 80, scale: 0.92, rotateX: 8 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0, scale: 1, rotateX: 0,
    transition: { duration: 0.9, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const slideInLeft = {
  hidden: { opacity: 0, x: -80 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const slideInRight = {
  hidden: { opacity: 0, x: 80 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(0, target, {
      duration: 2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [isInView, target]);

  return <span ref={ref}>{value}{suffix}</span>;
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const aiModels = [
  "Ray 2", "Luma Photon", "Runway Gen-4", "Kling V2.6", "Google Veo 3.1",
  "Hailuo 2.3", "Sora 2 Pro", "MiniMax", "PixVerse V5.5", "Wan 2.5",
  "ElevenLabs", "Flux Pro", "LTX Video", "Vidu Q1", "Seedance",
];

const highlights = [
  {
    badge: "New",
    badgeColor: "bg-[hsl(142,71%,45%)]",
    title: "Luma Ray 2 — Video Cinematografici",
    description: "Genera video cinematografici in 4K con keyframing, estensione e loop fluidi.",
    cta: "Prova Ora",
    route: "/luma-tools",
    image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80",
  },
  {
    badge: "Hot",
    badgeColor: "bg-[hsl(0,84%,60%)]",
    title: "Faceless Video Generator",
    description: "Crea video automatici da un semplice argomento. Script AI + B-roll + concatenazione.",
    cta: "Prova Ora",
    route: "/faceless-video",
    image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&q=80",
  },
  {
    badge: "New",
    badgeColor: "bg-[hsl(142,71%,45%)]",
    title: "Trailer Generator Cinematografico",
    description: "Trasforma un concept in un trailer professionale con scene AI e musica.",
    cta: "Prova Ora",
    route: "/trailer-generator",
    image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600&q=80",
  },
  {
    badge: "Hot",
    badgeColor: "bg-[hsl(0,84%,60%)]",
    title: "Timeline Editor Avanzato",
    description: "Editing multi-traccia con transizioni, effetti e sottotitoli automatici.",
    cta: "Prova Ora",
    route: "/timeline-editor",
    image: "https://images.unsplash.com/photo-1535016120720-40c646be5580?w=600&q=80",
  },
];

const landingDemoVideos = {
  flower: "/videos/landing-demo-flower.mp4",
  countdown: "/videos/showcase-countdown.mp4",
  sampleShort: "/videos/landing-demo-5s.mp4",
  sampleLong: "/videos/landing-demo-10s.mp4",
  sampleLandscape: "/videos/landing-demo-640.mp4",
  jellyfish: "/videos/hero-jellyfish.mp4",
  sintel: "/videos/showcase-sintel.mp4",
  mov: "/videos/showcase-mov.mp4",
} as const;

const showcaseSections = [
  {
    icon: Film,
    title: "Text to Video",
    subtitle: "Trasforma le parole in video mozzafiato.",
    description: "Descrivi la tua idea e lascia che i migliori modelli AI la trasformino in un video cinematografico. Perfetto per storytelling, pubblicità e contenuti social.",
    cta: "Crea Video",
    route: "/index",
    videos: [
      { url: landingDemoVideos.sampleLong, poster: "https://images.unsplash.com/photo-1518676590747-1e3dcf5a2e24?w=400&q=80", title: "Paesaggio AI" },
      { url: landingDemoVideos.sampleLandscape, poster: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80", title: "Natura Cinematica" },
      { url: landingDemoVideos.countdown, poster: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&q=80", title: "Foresta AI" },
      { url: landingDemoVideos.mov, poster: "https://images.unsplash.com/photo-1494783367193-149034c05e8f?w=400&q=80", title: "Oceano" },
    ],
    images: [],
  },
  {
    icon: ImageIcon,
    title: "Image to Video",
    subtitle: "Anima qualsiasi immagine con l'AI.",
    description: "Carica un'immagine e trasformala in un video dinamico. Controlla il movimento, la durata e lo stile con i modelli più avanzati.",
    cta: "Anima Immagine",
    route: "/index",
    videos: [
      { url: landingDemoVideos.sampleShort, poster: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=400&q=80", title: "Animazione AI" },
      { url: landingDemoVideos.sintel, poster: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80", title: "Ritratto Animato" },
      { url: landingDemoVideos.jellyfish, poster: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80", title: "Panorama" },
      { url: landingDemoVideos.flower, poster: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80", title: "Montagne" },
    ],
    images: [],
  },
  {
    icon: Wand2,
    title: "Generazione Immagini AI",
    subtitle: "Crea visual straordinari dalle parole.",
    description: "Genera immagini fotorealistiche, illustrazioni e concept art con Flux, PIAPI, Luma Photon e altri modelli di punta.",
    cta: "Genera Immagine",
    route: "/index",
    videos: [],
    images: [
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80",
      "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&q=80",
      "https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?w=400&q=80",
      "https://images.unsplash.com/photo-1534972195531-d756b9bfa9f2?w=400&q=80",
    ],
  },
];

const features = [
  { icon: Video, title: "30+ Modelli AI Video", description: "Runway, Kling, Luma, Veo, Sora, MiniMax e molti altri in un'unica interfaccia." },
  { icon: Layout, title: "Storyboard Intelligenti", description: "Pianifica, organizza e genera le scene con storyboard interattivi." },
  { icon: Wand2, title: "Timeline Editor Pro", description: "Editing multi-traccia, transizioni, effetti audio e sottotitoli automatici." },
  { icon: Mic, title: "Audio & Voiceover AI", description: "Clonazione vocale, TTS, musica AI e mixing audio professionale." },
  { icon: Film, title: "Faceless & Trailer", description: "Workflow automatizzati per creare video faceless e trailer cinematografici." },
  { icon: Music, title: "Luma Photon & Ray 2", description: "Generazione immagini e video direttamente via API Luma Labs." },
];

const getPlans = (isAnnual: boolean) => [
  {
    name: "Free",
    price: "€0",
    period: "/mese",
    features: ["5 generazioni video/mese", "Generazione immagini AI", "Risoluzione 720p", "1 storyboard", "Text-to-Speech base"],
    cta: "Inizia Gratis",
    highlighted: false,
  },
  {
    name: "Premium",
    price: isAnnual ? "€15,90" : "€19,90",
    period: "/mese",
    yearlyTotal: isAnnual ? "€190,80/anno" : undefined,
    features: ["50 generazioni video/mese", "Immagini illimitate", "1080p", "10 storyboard", "Workflow AI (Freepik, Vidu, LTX)", "Faceless Video & Trailer", "Talking Avatar", "Voice cloning & Musica AI", "Timeline editor", "Accesso API", "Multi-provider"],
    cta: "Passa a Premium",
    highlighted: true,
  },
  {
    name: "Business",
    price: isAnnual ? "€63,90" : "€79,90",
    period: "/mese",
    yearlyTotal: isAnnual ? "€766,80/anno" : undefined,
    features: ["Generazioni illimitate", "Immagini illimitate", "4K", "Storyboard illimitati", "Tutti i Workflow AI", "Faceless, Trailer & Avatar", "Voice cloning & Musica AI", "Timeline avanzato", "API dedicata + priorità", "Supporto prioritario"],
    cta: "Passa a Business",
    highlighted: false,
  },
];

function HeroReelParallax() {
  const reelRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: reelRef,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.92, 1, 0.96]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [4, 0, -2]);

  const demos = [
    { url: landingDemoVideos.flower, label: "Text → Video" },
    { url: landingDemoVideos.jellyfish, label: "Cinematic AI" },
    { url: landingDemoVideos.sintel, label: "Image → Video" },
  ];

  return (
    <motion.div
      ref={reelRef}
      style={{ y, scale, rotateX, perspective: 1200 }}
      className="mt-14 max-w-5xl mx-auto will-change-transform"
    >
      <div className="relative rounded-2xl overflow-hidden animate-glow-pulse">
        <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-[hsl(217,91%,60%)] via-[hsl(270,60%,55%)] to-[hsl(25,95%,63%)] opacity-60 blur-sm animate-glow-spin" />
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-[hsl(217,91%,60%)] via-[hsl(270,60%,55%)] to-[hsl(25,95%,63%)] opacity-40" />
        <div className="relative rounded-2xl overflow-hidden bg-[hsl(224,30%,10%)]">
          <div className="grid grid-cols-3 gap-0.5">
            {demos.map((demo, i) => (
              <div key={i} className="relative aspect-video overflow-hidden group bg-[hsl(224,30%,8%)]">
                <video
                  ref={(el) => {
                    if (el) {
                      el.muted = true;
                      el.play().catch(() => {});
                    }
                  }}
                  src={demo.url}
                  autoPlay muted loop playsInline preload="auto"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(225,25%,5%/0.7)] via-transparent to-transparent" />
                <span className="absolute bottom-2 left-3 text-[10px] font-semibold text-[hsl(215,20%,80%)] bg-[hsl(225,25%,8%/0.7)] backdrop-blur-sm px-2 py-0.5 rounded-md">
                  {demo.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-[hsl(215,20%,45%)] text-center mt-3 font-medium">
        ▲ Video generati interamente con AI Production Hub
      </p>
    </motion.div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const [isAnnual, setIsAnnual] = useState(false);
  const plans = getPlans(isAnnual);

  return (
    <div className="min-h-screen bg-[hsl(225,25%,5%)] text-[hsl(210,40%,98%)] overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[hsl(217,91%,60%/0.08)] blur-[150px]" />
        <div className="absolute top-[40%] right-[-15%] w-[700px] h-[700px] rounded-full bg-[hsl(270,60%,55%/0.06)] blur-[160px]" />
        <div className="absolute bottom-[-15%] left-[25%] w-[600px] h-[600px] rounded-full bg-[hsl(25,95%,63%/0.05)] blur-[140px]" />
      </div>

      {/* Top promo bar */}
      <div className="relative z-50 bg-gradient-to-r from-[hsl(270,60%,45%)] via-[hsl(217,91%,50%)] to-[hsl(270,60%,45%)] text-white text-center py-2.5 px-4 text-sm font-medium">
        <span className="inline-flex items-center gap-3">
          <span className="bg-[hsl(45,93%,58%)] text-[hsl(225,25%,5%)] px-2 py-0.5 rounded text-xs font-bold">🔥 LANCIO</span>
          <span>Luma Ray 2 & Photon ora disponibili — Video e Immagini cinematografiche</span>
          <button onClick={() => navigate("/luma-tools")} className="underline underline-offset-2 hover:no-underline ml-1 font-semibold">Prova Ora →</button>
        </span>
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-50 border-b border-[hsl(224,30%,12%)] bg-[hsl(225,25%,5%/0.85)] backdrop-blur-2xl sticky top-0"
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logoImg} alt="AI Production Hub" className="w-28 h-28 rounded-full object-cover shadow-[0_0_30px_hsl(217,91%,60%/0.5)]" />
            <span className="text-xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-[hsl(210,40%,98%)] to-[hsl(215,20%,75%)] bg-clip-text text-transparent">AI Production</span>{" "}
              <span className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] bg-clip-text text-transparent">Hub</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-[hsl(215,20%,65%)]">
            <button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white transition-colors">Funzionalità</button>
            <button onClick={() => document.getElementById("showcase")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white transition-colors">Showcase</button>
            <button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white transition-colors">Prezzi</button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")} className="text-[hsl(215,20%,65%)] hover:text-white hover:bg-[hsl(224,30%,12%)]">
              Accedi
            </Button>
            <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] text-white border-0 hover:opacity-90 shadow-[0_0_20px_hsl(217,91%,60%/0.3)]">
              Inizia Gratis
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* ===== HERO — Full viewport ===== */}
      <section ref={heroRef} className="relative z-10 min-h-[92vh] flex items-center justify-center overflow-hidden">
        <motion.div className="absolute inset-0" style={{ scale: heroScale }}>
          <img src={heroBg} alt="" width={1920} height={1080} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(225,25%,5%/0.3)] via-[hsl(225,25%,5%/0.55)] to-[hsl(225,25%,5%)]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(225,25%,5%/0.4)] via-transparent to-[hsl(225,25%,5%/0.4)]" />
        </motion.div>

        <motion.div style={{ opacity: heroOpacity }} className="relative container mx-auto px-4 text-center max-w-5xl">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            {/* Logo in Hero */}
            <motion.div variants={fadeUp} custom={0} className="flex justify-center mb-6">
              <img src={logoImg} alt="AI Production Hub" className="w-72 h-72 rounded-full object-cover shadow-[0_0_60px_hsl(217,91%,60%/0.5),0_0_120px_hsl(270,60%,55%/0.3)]" />
            </motion.div>

            <motion.div variants={fadeUp} custom={0.5} className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[hsl(217,91%,60%/0.3)] bg-[hsl(217,91%,60%/0.08)] text-[hsl(217,91%,80%)] text-sm font-medium mb-8 backdrop-blur-md drop-shadow-[0_4px_16px_hsl(225,25%,5%)] shadow-[0_0_20px_hsl(225,25%,5%/0.8)]">
              <Zap className="w-4 h-4 text-[hsl(45,93%,58%)]" />
              All-in-one AI Video & Image Production Studio
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6 leading-[1.05] [-webkit-text-stroke:3px_black] [text-shadow:-3px_-3px_0_black,3px_-3px_0_black,-3px_3px_0_black,3px_3px_0_black,0_0_20px_black,0_0_40px_black,0_0_80px_hsl(225,25%,2%/0.95)]">
              <span className="block">All-in-one AI</span>
              <span className="block bg-gradient-to-r from-[hsl(217,91%,60%)] via-[hsl(270,60%,65%)] to-[hsl(25,95%,63%)] bg-clip-text text-transparent [-webkit-text-stroke:3px_black] drop-shadow-[0_0_30px_hsl(217,91%,60%/0.5)]">
                Video & Image
              </span>
              <span className="block">Generator</span>
            </motion.h1>

            {/* Model marquee subtitle */}
            <motion.div variants={fadeUp} custom={2} className="text-base md:text-lg mb-8 [text-shadow:0_3px_30px_hsl(225,25%,2%),0_6px_50px_hsl(225,25%,2%),0_0_70px_hsl(225,25%,2%/0.9)] font-bold text-white whitespace-pre-line">
              {aiModels.slice(0, 9).join(" | ")}{" |\n"}{aiModels.slice(9).join(" | ")}
            </motion.div>

            {/* Highlight badges */}
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap justify-center gap-3 mb-10 drop-shadow-[0_4px_20px_hsl(225,25%,5%)]">
              <button
                onClick={() => navigate("/luma-tools")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[hsl(142,71%,45%/0.3)] bg-[hsl(142,71%,45%/0.08)] hover:bg-[hsl(142,71%,45%/0.15)] text-[hsl(142,71%,65%)] text-sm font-medium backdrop-blur-md transition-all"
              >
                <span className="bg-[hsl(142,71%,45%)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">New</span>
                Luma Ray 2 disponibile
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/faceless-video")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[hsl(0,84%,60%/0.3)] bg-[hsl(0,84%,60%/0.08)] hover:bg-[hsl(0,84%,60%/0.15)] text-[hsl(0,84%,75%)] text-sm font-medium backdrop-blur-md transition-all"
              >
                <span className="bg-[hsl(0,84%,60%)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">Hot</span>
                Faceless Video Creator
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div variants={fadeUp} custom={4} className="flex flex-col sm:flex-row gap-4 justify-center drop-shadow-[0_6px_24px_hsl(225,25%,5%)]">
              <Button
                size="lg"
                onClick={() => navigate("/index")}
                className="text-lg px-10 py-6 bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] text-white border-0 hover:opacity-90 shadow-[0_0_40px_hsl(217,91%,60%/0.4)] rounded-xl font-semibold transition-all duration-300"
              >
                <Play className="w-5 h-5 mr-2" />
                Crea Video
              </Button>
              <Button
                size="lg"
                onClick={() => navigate("/index")}
                className="text-lg px-10 py-6 border-[hsl(224,30%,22%)] bg-[hsl(224,30%,10%/0.6)] text-white hover:bg-[hsl(224,30%,15%)] hover:border-[hsl(217,91%,60%/0.4)] backdrop-blur-md rounded-xl font-semibold transition-all duration-300"
                variant="outline"
              >
                <ImageIcon className="w-5 h-5 mr-2" />
                Crea Immagine
              </Button>
              <Button
                size="lg"
                onClick={() => navigate("/faceless-video")}
                className="text-lg px-10 py-6 bg-gradient-to-r from-[hsl(25,95%,53%)] to-[hsl(0,84%,60%)] text-white border-0 hover:opacity-90 shadow-[0_0_30px_hsl(25,95%,53%/0.3)] rounded-xl font-semibold transition-all duration-300"
              >
                <Zap className="w-5 h-5 mr-2" />
                One-Click Video
              </Button>
            </motion.div>

            {/* Hero Demo Video Reel with Parallax */}
            <HeroReelParallax />
          </motion.div>

          {/* Stats */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
            className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto"
          >
            {[
              { value: 30, suffix: "+", label: "Modelli AI" },
              { value: 4, suffix: "K", label: "Max Resolution" },
              { value: 10, suffix: "s", label: "Per Video" },
              { value: 24, suffix: "/7", label: "Disponibilità" },
            ].map((stat, i) => (
              <motion.div key={stat.label} variants={parallaxReveal} custom={i} className="relative group" style={{ perspective: 600 }}>
                <div className="p-5 rounded-xl border border-[hsl(224,30%,15%)] bg-[hsl(225,25%,8%/0.7)] backdrop-blur-md group-hover:border-[hsl(217,91%,60%/0.3)] transition-all duration-300 group-hover:shadow-[0_0_30px_hsl(217,91%,60%/0.1)]">
                  <div className="text-3xl font-bold bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,65%)] bg-clip-text text-transparent">
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-xs text-[hsl(215,20%,55%)] mt-1">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ===== Scrolling AI Model Marquee ===== */}
      <div className="relative z-10 border-y border-[hsl(224,30%,12%)] bg-[hsl(225,25%,6%/0.8)] backdrop-blur-md overflow-hidden py-4">
        <div className="flex animate-[marquee_40s_linear_infinite]">
          {[...aiModels, ...aiModels, ...aiModels].map((model, i) => (
            <span key={i} className="flex-shrink-0 px-6 text-sm text-[hsl(215,20%,55%)] font-medium whitespace-nowrap">
              {model}
              <span className="ml-6 text-[hsl(217,91%,60%/0.3)]">•</span>
            </span>
          ))}
        </div>
      </div>

      {/* ===== Highlight Cards (New / Hot features) ===== */}
      <section className="relative z-10 py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="text-center mb-14"
          >
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-3">
              Funzionalità <span className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] bg-clip-text text-transparent">Appena Lanciate</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-[hsl(215,20%,60%)] text-lg">Le ultime novità per la produzione video AI professionale</motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
            style={{ perspective: 1000 }}
          >
            {highlights.map((item, i) => (
              <motion.div
                key={item.title}
                variants={parallaxReveal}
                custom={i}
                onClick={() => navigate(item.route)}
                className="group relative rounded-2xl overflow-hidden border border-[hsl(224,30%,15%)] bg-[hsl(225,25%,8%)] hover:border-[hsl(217,91%,60%/0.4)] cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_hsl(217,91%,60%/0.1)]"
              >
                <div className="relative h-44 overflow-hidden">
                  <img src={item.image} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(225,25%,8%)] via-[hsl(225,25%,8%/0.3)] to-transparent" />
                  <span className={`absolute top-3 left-3 ${item.badgeColor} text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider`}>
                    {item.badge}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-sm mb-2 group-hover:text-[hsl(217,91%,70%)] transition-colors">{item.title}</h3>
                  <p className="text-xs text-[hsl(215,20%,55%)] leading-relaxed mb-3">{item.description}</p>
                  <span className="text-xs font-medium text-[hsl(217,91%,65%)] flex items-center gap-1 group-hover:gap-2 transition-all">
                    {item.cta} <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== Showcase Sections ===== */}
      <section id="showcase" className="relative z-10">
        {showcaseSections.map((section, idx) => (
          <div key={section.title} className={`py-20 ${idx % 2 === 0 ? "" : "bg-[hsl(225,25%,7%)]"} border-t border-[hsl(224,30%,12%)]`}>
            <div className="container mx-auto px-4">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.15 }}
                variants={staggerContainer}
                className={`flex flex-col ${idx % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"} gap-12 items-center`}
              >
                {/* Text side */}
                <motion.div className="flex-1 max-w-xl" variants={idx % 2 === 0 ? slideInLeft : slideInRight}>
                  <motion.div variants={fadeUp} custom={0} className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(217,91%,60%/0.2)] to-[hsl(270,60%,55%/0.1)] flex items-center justify-center">
                      <section.icon className="w-5 h-5 text-[hsl(217,91%,70%)]" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold">{section.title}</h3>
                  </motion.div>
                  <motion.h4 variants={fadeUp} custom={1} className="text-xl md:text-2xl font-semibold text-[hsl(215,20%,80%)] mb-4">
                    {section.subtitle}
                  </motion.h4>
                  <motion.p variants={fadeUp} custom={2} className="text-[hsl(215,20%,60%)] leading-relaxed mb-6">
                    {section.description}
                  </motion.p>
                  <motion.div variants={fadeUp} custom={3}>
                    <Button
                      onClick={() => navigate(section.route)}
                      className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] text-white border-0 hover:opacity-90 shadow-[0_0_20px_hsl(217,91%,60%/0.3)] rounded-lg px-6"
                    >
                      {section.cta}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </motion.div>
                </motion.div>

                {/* Media grid side — mix videos + images */}
                <motion.div variants={idx % 2 === 0 ? slideInRight : slideInLeft} className="flex-1 grid grid-cols-2 gap-3 max-w-lg">
                  {section.videos?.map((vid, vidIdx) => (
                    <VideoShowcaseCard
                      key={`vid-${vidIdx}`}
                      videoUrl={vid.url}
                      posterUrl={vid.poster}
                      title={vid.title}
                      className={vidIdx === 0 && section.videos!.length + section.images.length > 2 ? "row-span-2 aspect-[3/4]" : "aspect-video"}
                    />
                  ))}
                  {section.images.map((img, imgIdx) => (
                    <div
                      key={`img-${imgIdx}`}
                      className={`rounded-xl overflow-hidden border border-[hsl(224,30%,15%)] ${imgIdx === 0 && (!section.videos || section.videos.length === 0) ? "row-span-2" : ""}`}
                    >
                      <img
                        src={img}
                        alt={`${section.title} esempio ${imgIdx + 1}`}
                        loading="lazy"
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            </div>
          </div>
        ))}
      </section>

      {/* ===== Live Video Counter ===== */}
      <LiveVideoCounter />

      {/* ===== Features Grid ===== */}
      <section id="features" className="relative z-10 py-24 border-t border-[hsl(224,30%,12%)]">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={staggerContainer} className="text-center mb-16">
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-4">
              Tutto ciò che serve per{" "}
              <span className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] bg-clip-text text-transparent">produrre con l'AI</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-[hsl(215,20%,60%)] text-lg max-w-2xl mx-auto">
              Una suite completa di strumenti per ogni fase della produzione video e immagini.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto"
          >
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={parallaxReveal}
                custom={i}
                style={{ perspective: 600 }}
                whileHover={{ y: -8, scale: 1.03, transition: { duration: 0.3 } }}
                className="group relative rounded-xl p-6 border border-[hsl(224,30%,15%)] bg-[hsl(225,25%,8%/0.5)] backdrop-blur-sm hover:border-[hsl(217,91%,60%/0.3)] hover:bg-[hsl(225,25%,10%/0.6)] transition-all duration-300"
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[hsl(217,91%,60%/0.04)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(217,91%,60%/0.15)] to-[hsl(270,60%,55%/0.08)] flex items-center justify-center mb-4 group-hover:shadow-[0_0_20px_hsl(217,91%,60%/0.15)] transition-all duration-300">
                    <feature.icon className="w-6 h-6 text-[hsl(217,91%,70%)]" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                  <p className="text-[hsl(215,20%,55%)] text-sm leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section id="pricing" className="relative z-10 py-24 border-t border-[hsl(224,30%,12%)]">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={staggerContainer} className="text-center mb-16">
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-4">Piani e Prezzi</motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-[hsl(215,20%,60%)] text-lg">Scegli il piano più adatto alle tue esigenze</motion.p>
          </motion.div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={`text-sm font-medium ${!isAnnual ? "text-white" : "text-[hsl(215,20%,50%)]"}`}>Mensile</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${isAnnual ? "bg-[hsl(217,91%,60%)]" : "bg-[hsl(224,30%,20%)]"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${isAnnual ? "translate-x-7" : "translate-x-0"}`} />
            </button>
            <span className={`text-sm font-medium ${isAnnual ? "text-white" : "text-[hsl(215,20%,50%)]"}`}>
              Annuale
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[hsl(217,91%,60%/0.15)] text-[hsl(217,91%,70%)] border border-[hsl(217,91%,60%/0.3)]">-20%</span>
            </span>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
          >
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                custom={i}
                className={`relative rounded-2xl p-8 border transition-all duration-300 ${
                  plan.highlighted
                    ? "border-[hsl(217,91%,60%/0.5)] bg-gradient-to-b from-[hsl(217,91%,60%/0.08)] to-[hsl(225,25%,8%)] shadow-[0_0_50px_hsl(217,91%,60%/0.12)] scale-[1.03]"
                    : "border-[hsl(224,30%,15%)] bg-[hsl(225,25%,8%)] hover:border-[hsl(224,30%,22%)]"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] text-xs font-semibold text-white flex items-center gap-1 shadow-[0_0_15px_hsl(217,91%,60%/0.4)]">
                    <Star className="w-3 h-3" /> Più Popolare
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-1">
                  <span className="text-5xl font-extrabold">{plan.price}</span>
                  <span className="text-[hsl(215,20%,55%)]">{plan.period}</span>
                </div>
                {plan.yearlyTotal && (
                  <p className="text-xs text-[hsl(215,20%,50%)] mb-5">Fatturato {plan.yearlyTotal}</p>
                )}
                {!plan.yearlyTotal && <div className="mb-5" />}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[hsl(215,20%,70%)]">
                      <CheckCircle2 className="w-4 h-4 text-[hsl(217,91%,60%)] shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full rounded-xl py-5 ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] text-white border-0 hover:opacity-90 shadow-[0_0_20px_hsl(217,91%,60%/0.3)]"
                      : "border-[hsl(224,30%,20%)] bg-[hsl(225,25%,10%)] text-white hover:bg-[hsl(225,25%,14%)] hover:border-[hsl(217,91%,60%/0.3)]"
                  }`}
                  variant={plan.highlighted ? "default" : "outline"}
                  onClick={() => navigate("/auth")}
                >
                  {plan.cta}
                </Button>
              </motion.div>
            ))}
          </motion.div>

          {/* Visual comparison grid */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={staggerContainer}
            className="mt-20 max-w-5xl mx-auto"
          >
            <motion.h3
              variants={fadeUp}
              className="text-2xl md:text-3xl font-bold text-center mb-12"
            >
              Cosa ottieni con ogni{" "}
              <span className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] bg-clip-text text-transparent">piano</span>
            </motion.h3>

            {[
              {
                category: "Video & Immagini",
                icon: Film,
                items: [
                  { name: "Generazioni video", free: "5/mese", premium: "50/mese", business: "Illimitate" },
                  { name: "Risoluzione", free: "720p", premium: "1080p", business: "4K" },
                  { name: "Immagini AI", free: "Incluse", premium: "Illimitate", business: "Illimitate" },
                  { name: "Multi-provider", free: false, premium: true, business: true },
                ],
              },
              {
                category: "Workflow & Automazioni",
                icon: Wand2,
                items: [
                  { name: "Workflow AI a nodi", free: false, premium: true, business: true },
                  { name: "Freepik / Vidu / LTX / Luma", free: false, premium: true, business: true },
                  { name: "Faceless Video & Trailer", free: false, premium: true, business: true },
                  { name: "Talking Avatar", free: false, premium: true, business: true },
                  { name: "Script-to-Storyboard AI", free: false, premium: true, business: true },
                ],
              },
              {
                category: "Audio & Produzione",
                icon: Mic,
                items: [
                  { name: "Text-to-Speech", free: true, premium: true, business: true },
                  { name: "Clonazione vocale", free: false, premium: true, business: true },
                  { name: "Musica AI & mixing", free: false, premium: true, business: true },
                  { name: "Timeline editor", free: false, premium: true, business: true },
                  { name: "Storyboard", free: "1", premium: "10", business: "Illimitati" },
                ],
              },
              {
                category: "API & Supporto",
                icon: Zap,
                items: [
                  { name: "Accesso API", free: false, premium: true, business: true },
                  { name: "JSON2Video integration", free: false, premium: true, business: true },
                  { name: "API dedicata", free: false, premium: false, business: true },
                  { name: "Supporto prioritario", free: false, premium: false, business: true },
                ],
              },
            ].map((section, si) => (
              <motion.div
                key={section.category}
                variants={fadeUp}
                custom={si}
                className="mb-6"
              >
                <div className="flex items-center gap-3 mb-4 px-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[hsl(217,91%,60%/0.15)] to-[hsl(270,60%,55%/0.08)] flex items-center justify-center">
                    <section.icon className="w-4.5 h-4.5 text-[hsl(217,91%,70%)]" />
                  </div>
                  <h4 className="text-sm font-semibold text-[hsl(215,20%,80%)] uppercase tracking-wider">{section.category}</h4>
                </div>

                <div className="rounded-xl border border-[hsl(224,30%,15%)] bg-[hsl(225,25%,8%/0.5)] backdrop-blur-sm overflow-hidden">
                  {/* Column headers */}
                  <div className="grid grid-cols-4 border-b border-[hsl(224,30%,13%)] bg-[hsl(225,25%,7%/0.8)]">
                    <div className="p-3 text-xs font-medium text-[hsl(215,20%,45%)]">Funzionalità</div>
                    <div className="p-3 text-center text-xs font-medium text-[hsl(215,20%,45%)]">Free</div>
                    <div className="p-3 text-center text-xs font-medium text-[hsl(217,91%,70%)]">Premium</div>
                    <div className="p-3 text-center text-xs font-medium text-[hsl(215,20%,45%)]">Business</div>
                  </div>
                  {section.items.map((item, ii) => (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: si * 0.05 + ii * 0.03, duration: 0.4 }}
                      className={`grid grid-cols-4 border-b border-[hsl(224,30%,12%)] last:border-b-0 ${ii % 2 === 1 ? "bg-[hsl(225,25%,7%/0.3)]" : ""}`}
                    >
                      <div className="p-3 text-sm text-[hsl(215,20%,65%)]">{item.name}</div>
                      {(["free", "premium", "business"] as const).map((plan) => {
                        const val = item[plan];
                        return (
                          <div key={plan} className={`p-3 text-center text-sm ${plan === "premium" ? "bg-[hsl(217,91%,60%/0.04)]" : ""}`}>
                            {typeof val === "boolean" ? (
                              val ? (
                                <CheckCircle2 className="w-4 h-4 text-[hsl(142,71%,45%)] mx-auto" />
                              ) : (
                                <span className="block w-4 h-[2px] bg-[hsl(215,20%,25%)] mx-auto rounded-full mt-[7px]" />
                              )
                            ) : (
                              <span className="font-medium text-[hsl(215,20%,75%)]">{val}</span>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}

            <motion.div
              variants={fadeUp}
              custom={4}
              className="text-center mt-10"
            >
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] text-white border-0 hover:opacity-90 shadow-[0_0_30px_hsl(217,91%,60%/0.3)] rounded-xl px-10 py-5"
              >
                Inizia Gratuitamente
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <LandingFAQ />


      {/* ===== Testimonials ===== */}
      <section className="relative z-10 py-24 border-t border-[hsl(224,30%,12%)] overflow-hidden">
        <div className="absolute inset-0">
          <img src={studioBg} alt="" loading="lazy" width={1920} height={1080} className="w-full h-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(225,25%,5%)] via-[hsl(225,25%,5%/0.7)] to-[hsl(225,25%,5%)]" />
        </div>
        <div className="relative container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={staggerContainer} className="text-center mb-16">
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-4">
              Cosa dicono i{" "}
              <span className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] bg-clip-text text-transparent">nostri utenti</span>
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
          >
            {[
              { name: "Marco Giustini", role: "Video Producer", text: "AI Production Hub ha rivoluzionato il mio flusso di lavoro. Creo in poche ore ciò che prima richiedeva giorni.", stars: 5 },
              { name: "Giulia Ventelli", role: "Content Creator", text: "Lo storyboard intelligente è fantastico. Posso pianificare e generare video complessi con una facilità incredibile.", stars: 5 },
              { name: "Alessandro Ralli", role: "Marketing Manager", text: "La qualità dei video generati è impressionante. I nostri contenuti social hanno avuto un incremento del 300% in engagement.", stars: 5 },
            ].map((t, i) => (
              <motion.div
                key={t.name}
                variants={fadeUp}
                custom={i}
                className="group rounded-2xl p-6 border border-[hsl(224,30%,15%)] bg-[hsl(225,25%,8%/0.5)] backdrop-blur-sm hover:border-[hsl(217,91%,60%/0.3)] transition-all duration-300"
              >
                <Quote className="w-8 h-8 text-[hsl(217,91%,60%/0.25)] mb-4" />
                <p className="text-[hsl(215,20%,70%)] text-sm leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: t.stars }).map((_, s) => (
                    <Star key={s} className="w-4 h-4 fill-[hsl(45,93%,58%)] text-[hsl(45,93%,58%)]" />
                  ))}
                </div>
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="text-xs text-[hsl(215,20%,50%)]">{t.role}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="relative z-10 py-24 border-t border-[hsl(224,30%,12%)]">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={staggerContainer}>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold mb-6">
              Pronto a creare il tuo prossimo{" "}
              <span className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(25,95%,63%)] bg-clip-text text-transparent">capolavoro?</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-[hsl(215,20%,60%)] text-lg mb-10">
              Unisciti a migliaia di creativi che stanno già usando AI Production Hub per produrre contenuti straordinari.
            </motion.p>
            <motion.div variants={fadeUp} custom={2}>
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="text-lg px-12 py-6 bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] text-white border-0 hover:opacity-90 shadow-[0_0_40px_hsl(217,91%,60%/0.4)] rounded-xl font-semibold"
              >
                Inizia Gratuitamente
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative z-10 border-t border-[hsl(224,30%,12%)] py-10"
      >
        <div className="container mx-auto px-4 text-center text-sm text-[hsl(215,20%,45%)]">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src={logoImg} alt="AI Production Hub" className="w-24 h-24 rounded-full object-cover" />
            <span className="font-semibold bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] bg-clip-text text-transparent">
              AI Production Hub
            </span>
          </div>
          <p>© {new Date().getFullYear()} AI Production Hub — StudioBook Edizioni. Tutti i diritti riservati.</p>
        </div>
      </motion.footer>
    </div>
  );
}
