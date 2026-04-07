import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, useInView, animate } from "framer-motion";
import { Activity, Film, CheckCircle2, TrendingUp } from "lucide-react";

interface CounterStat {
  total: number;
  completed: number;
  processing: number;
}

function AnimatedNumber({ value, duration = 2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, isInView, duration]);

  return <span ref={ref}>{display.toLocaleString("it-IT")}</span>;
}

export function LiveVideoCounter() {
  const [stats, setStats] = useState<CounterStat>({ total: 0, completed: 0, processing: 0 });

  const fetchStats = async () => {
    const { count: total } = await supabase
      .from("video_generations")
      .select("*", { count: "exact", head: true });

    const { count: completed } = await supabase
      .from("video_generations")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    const { count: processing } = await supabase
      .from("video_generations")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "processing"]);

    setStats({
      total: total || 0,
      completed: completed || 0,
      processing: processing || 0,
    });
  };

  useEffect(() => {
    fetchStats();
    const channel = supabase
      .channel("landing-counter")
      .on("postgres_changes", { event: "*", schema: "public", table: "video_generations" }, fetchStats)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const counters = [
    {
      icon: Film,
      value: stats.total,
      label: "Video Generati",
      color: "from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)]",
      glow: "hsl(217,91%,60%/0.3)",
    },
    {
      icon: CheckCircle2,
      value: stats.completed,
      label: "Completati",
      color: "from-[hsl(142,71%,45%)] to-[hsl(160,60%,45%)]",
      glow: "hsl(142,71%,45%/0.3)",
    },
    {
      icon: Activity,
      value: stats.processing,
      label: "In Elaborazione",
      color: "from-[hsl(25,95%,63%)] to-[hsl(0,84%,60%)]",
      glow: "hsl(25,95%,63%/0.3)",
      live: true,
    },
  ];

  return (
    <section className="relative z-10 py-16 border-t border-[hsl(224,30%,12%)]">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[hsl(142,71%,45%/0.3)] bg-[hsl(142,71%,45%/0.06)] text-[hsl(142,71%,65%)] text-sm font-medium mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(142,71%,45%)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(142,71%,50%)]" />
            </span>
            Statistiche in tempo reale
          </div>
          <h2 className="text-3xl md:text-4xl font-bold">
            La nostra community{" "}
            <span className="bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(270,60%,55%)] bg-clip-text text-transparent">crea ogni giorno</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {counters.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="group relative rounded-2xl p-8 border border-[hsl(224,30%,15%)] bg-[hsl(225,25%,8%/0.6)] backdrop-blur-sm text-center hover:border-[hsl(217,91%,60%/0.3)] transition-all duration-300"
            >
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${c.color} opacity-[0.03] group-hover:opacity-[0.06] transition-opacity`} />
              <div className="relative">
                <div className={`w-14 h-14 mx-auto rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-4 shadow-[0_0_25px_${c.glow}]`}>
                  <c.icon className="w-7 h-7 text-white" />
                </div>
                <div className={`text-4xl md:text-5xl font-extrabold bg-gradient-to-r ${c.color} bg-clip-text text-transparent mb-2`}>
                  <AnimatedNumber value={c.value} />
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-[hsl(215,20%,55%)]">
                  {c.live && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(25,95%,63%)] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(25,95%,63%)]" />
                    </span>
                  )}
                  {c.label}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
