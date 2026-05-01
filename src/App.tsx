/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useScroll, useTransform, motion, AnimatePresence, useSpring, useMotionValue } from "motion/react";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { ChevronDown, Shield, Zap, Wind, Ghost, Menu, X } from "lucide-react";
import { cn } from "./lib/utils";

// --- Components ---

/**
 * CustomCursor provides a tactical HUD following the mouse.
 */
function CustomCursor() {
  const [isHovering, setIsHovering] = useState(false);
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);
  
  const springConfig = { stiffness: 450, damping: 40 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      
      const target = e.target as HTMLElement;
      setIsHovering(!!target.closest('button, a, .group'));
    };
    window.addEventListener("mousemove", moveCursor);
    return () => window.removeEventListener("mousemove", moveCursor);
  }, []);

  return (
    <motion.div 
      className="fixed top-0 left-0 w-12 h-12 pointer-events-none z-[9999] hidden md:block mix-blend-difference"
      style={{ 
        x: cursorX, 
        y: cursorY, 
        translateX: "-50%", 
        translateY: "-50%",
      }}
    >
      {/* Outer Circle */}
      <motion.div 
        animate={{ 
          scale: isHovering ? 1.5 : 1,
          rotate: isHovering ? 90 : 0
        }}
        className="absolute inset-0 border border-wu-accent/30 rounded-full"
      />
      {/* Crosshair lines */}
      <div className="absolute top-1/2 left-0 w-2 h-[1px] bg-wu-accent/60 -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-2 h-[1px] bg-wu-accent/60 -translate-y-1/2" />
      <div className="absolute top-0 left-1/2 w-[1px] h-2 bg-wu-accent/60 -translate-x-1/2" />
      <div className="absolute bottom-0 left-1/2 w-[1px] h-2 bg-wu-accent/60 -translate-x-1/2" />
      
      {/* Center dot */}
      <motion.div 
        animate={{ scale: isHovering ? 2 : 1 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-wu-accent shadow-[0_0_15px_#22d3ee]" 
      />
    </motion.div>
  );
}

/**
 * SequenceScroll handles the frame-by-frame animation using a canvas.
 * It maps scroll progress to an array of images.
 */
function SequenceScroll({ frameCount = 300, imagePrefix = "real", containerRef }: { frameCount?: number; imagePrefix?: string; containerRef: React.RefObject<HTMLDivElement> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useRef<HTMLImageElement[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [activeFrame, setActiveFrame] = useState(0);

  const imageUrls = useMemo(() => {
    const baseUrl = "src/ww/";
    const isDevelopment = imagePrefix === "demo_";
    
    return Array.from({ length: frameCount }, (_, i) => {
      if (!isDevelopment) {
        // Filename: ezgif-frame-001.jpg, ezgif-frame-002.jpg ...
        const frameNumber = String(i + 1).padStart(3, '0');
        return `${baseUrl}ezgif-frame-${frameNumber}.jpg`;
      }
      return `https://picsum.photos/id/${(i % 10) + 20}/1920/1080`;
    });
  }, [frameCount, imagePrefix]);

  useEffect(() => {
    let loadedCount = 0;
    imageUrls.forEach((url, i) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        images.current[i] = img;
        loadedCount++;
        if (loadedCount === frameCount) {
          setImagesLoaded(true);
          render(0);
        }
      };
    });
  }, [imageUrls, frameCount]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const frameIndex = useTransform(smoothProgress, [0, 1], [0, frameCount - 1]);

  const render = (index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const roundedIndex = Math.round(index);
    if (roundedIndex !== activeFrame) {
      setActiveFrame(roundedIndex);
    }

    const img = images.current[roundedIndex];
    if (img) {
      const canvasAspect = canvas.width / canvas.height;
      // After 90 degree rotation, image width and height effectively swap
      const rotatedImgAspect = img.height / img.width;
      let scaledW, scaledH;

      if (canvasAspect > rotatedImgAspect) {
        scaledW = canvas.width;
        scaledH = canvas.width / rotatedImgAspect;
      } else {
        scaledH = canvas.height;
        scaledW = canvas.height * rotatedImgAspect;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(3 * Math.PI / 2); // 270 degrees clockwise (another 180 from 90)
      
      // Draw the image centered. 
      // After 90 deg rotation: 
      // image native width corresponds to target screen height (scaledH)
      // image native height corresponds to target screen width (scaledW)
      ctx.drawImage(img, -scaledH / 2, -scaledW / 2, scaledH, scaledW);
      ctx.restore();
    }
  };

  useEffect(() => {
    const unsubscribe = frameIndex.on("change", (latest) => {
      render(latest);
    });
    return () => unsubscribe();
  }, [frameIndex, activeFrame]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        render(frameIndex.get());
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="h-full w-full object-cover"
        aria-hidden="true"
      />
      
      {/* Visual Overlays */}
      <div className="absolute inset-0 cinematic-vignette pointer-events-none" />
      <div className="absolute inset-0 tech-grid pointer-events-none opacity-20" />
      
      {/* Abstract Tech Patterns */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] border border-wu-accent/10 rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] border border-blue-500/5 rounded-full blur-2xl pointer-events-none animate-pulse-slow delay-700" />

      {/* Cinematic Bars */}
      <div className="absolute top-0 left-0 w-full h-8 bg-black/60 backdrop-blur-sm border-b border-white/5 z-20" />
      <div className="absolute bottom-0 left-0 w-full h-8 bg-black/60 backdrop-blur-sm border-t border-white/5 z-20" />

      {/* HUD: Resonator Status (Bottom Left) */}
      <div className="absolute bottom-12 left-8 md:left-12 z-30 flex gap-4 md:gap-6 items-end pointer-events-none">
        <div className="relative">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-wu-accent/20 to-transparent border border-wu-accent/30 rotate-45 flex items-center justify-center overflow-hidden">
            <div className="-rotate-45 text-[6px] md:text-[8px] font-black tracking-widest text-wu-accent">ROVER</div>
          </div>
          <div className="absolute -top-1 -right-1 w-1.5 h-1.5 md:w-2 md:h-2 bg-wu-accent rotate-45 shadow-[0_0_10px_#22d3ee]"></div>
        </div>
        <div className="flex flex-col gap-1 pb-1">
          <div className="text-[8px] md:text-[10px] font-black tracking-[0.2em] uppercase whitespace-nowrap">RES-TYPE: SPECTRO</div>
          <div className="flex gap-1 items-center">
            <motion.div 
              className="h-1 bg-wu-accent shadow-[0_0_8px_#22d3ee]"
              animate={{ width: [30, 60, 45, 80] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <div className="w-4 md:w-8 h-1 bg-white/10" />
            <div className="w-2 md:w-4 h-1 bg-white/10" />
          </div>
          <div className="text-[6px] md:text-[7px] text-white/30 uppercase tracking-widest whitespace-nowrap">Resonant Level Peak</div>
        </div>
      </div>

      {/* HUD: Frame Info (Bottom Right) */}
      <div className="absolute bottom-12 right-8 md:right-12 z-30 text-right pointer-events-none">
        <div className="text-[6px] md:text-[7px] text-white/40 uppercase tracking-[0.3em] mb-1 font-mono">Sync Sequence</div>
        <div className="text-sm md:text-xl font-mono tracking-tighter tabular-nums">
          <span className="text-wu-accent">{String(activeFrame + 1).padStart(2, '0')}</span> 
          <span className="text-white/20 mx-1">//</span> 
          <span className="text-white/20">{frameCount}</span>
        </div>
      </div>

      {!imagesLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-[100]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-0.5 w-48 bg-wu-accent/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-wu-accent" 
                animate={{ width: ["0%", "100%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <p className="text-wu-accent font-mono text-[9px] tracking-[0.5em] uppercase animate-pulse">Initializing Resonance...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={cn(
      "fixed top-0 left-0 w-full z-50 transition-all duration-700 h-24 flex items-center px-8 md:px-12",
      scrolled ? "bg-black/90 backdrop-blur-xl border-b border-white/5 h-20" : "bg-transparent"
    )}>
      <div className="flex items-center gap-6 md:gap-10">
        <div className="text-xl md:text-2xl font-black tracking-[0.2em] text-wu-accent cursor-pointer group flex items-center gap-4">
          W.WAVES
          <div className="h-px w-4 md:w-8 bg-white/20 group-hover:w-12 transition-all duration-500" />
        </div>
        
        <ul className="hidden lg:flex gap-10 text-[10px] uppercase tracking-[0.4em] font-black text-white/50">
          {["Resonators", "Echoes", "Archives", "Map"].map((item) => (
            <li key={item} className="hover:text-wu-accent cursor-pointer transition-colors relative group">
              {item}
              <motion.div className="absolute -bottom-1 left-0 h-[1px] bg-wu-accent w-0 group-hover:w-full transition-all" />
            </li>
          ))}
        </ul>
      </div>

      <div className="ml-auto flex items-center gap-4 md:gap-6">
        <div className="hidden md:flex w-10 h-10 rounded-full border border-white/10 items-center justify-center text-[10px] font-mono text-white/40 cursor-pointer hover:bg-white/5 hover:text-wu-accent transition-all">
          01
        </div>
        <button className="bg-white text-black px-6 md:px-8 py-2 md:py-3 text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer hover:bg-wu-accent transition-colors shadow-xl">
          Play
        </button>
        <button className="lg:hidden text-wu-accent p-2" onClick={() => setIsOpen(true)}>
          <Menu size={24} />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            className="fixed inset-0 bg-black z-[100] p-12 flex flex-col gap-8"
          >
            <div className="flex justify-between items-center mb-12">
               <span className="text-wu-accent font-black tracking-widest">W.WAVES</span>
               <button className="text-wu-accent" onClick={() => setIsOpen(false)}>
                <X size={32} />
              </button>
            </div>
            {["Resonators", "Echoes", "Archives", "Map"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-4xl md:text-5xl font-black uppercase tracking-tighter hover:text-wu-accent transition-all"
                onClick={() => setIsOpen(false)}
              >
                {item}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}


function ScrollPrompt({ scrollYProgress }: { scrollYProgress: any }) {
  const opacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.05], [0, 20]);

  return (
    <motion.div 
      style={{ opacity, y }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2, duration: 1 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-4 pointer-events-none"
    >
      <div className="relative group flex flex-col items-center">
        <div className="w-px h-12 bg-white/20 relative overflow-hidden">
          <motion.div 
            animate={{ top: ["-100%", "100%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-wu-accent to-transparent"
          />
        </div>
        <div className="w-[18px] h-[30px] rounded-full border border-wu-accent/30 mt-4 flex justify-center p-1">
          <motion.div 
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1 h-1.5 bg-wu-accent rounded-full" 
          />
        </div>
      </div>
      <span className="text-[9px] uppercase tracking-[1em] text-wu-accent font-black ml-2 animate-pulse whitespace-nowrap">Keep Scrolling</span>
    </motion.div>
  );
}

function ResonanceDataFragment({ frame, range, title, subtitle, children, align = "left", status = "STABLE" }: { 
  frame: number, 
  range: [number, number], 
  title: string, 
  subtitle: string, 
  children: React.ReactNode,
  align?: "left" | "right",
  status?: string
}) {
  const isVisible = frame >= range[0] && frame <= range[1];
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: align === "left" ? -60 : 60, filter: "blur(15px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: align === "left" ? -30 : 30, filter: "blur(5px)" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "fixed top-1/2 -translate-y-1/2 z-40 max-w-sm pointer-events-auto",
            align === "left" ? "left-8 md:left-24" : "right-8 md:right-24"
          )}
        >
          <div className={cn(
            "p-0.5 relative group",
            align === "left" ? "rounded-r-lg" : "rounded-l-lg"
          )}>
             {/* Animated Border Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-wu-accent/40 via-white/5 to-wu-accent/10 opacity-50 blur-sm group-hover:opacity-100 transition-opacity" />
            
            <div className={cn(
              "relative bg-black/80 backdrop-blur-2xl p-8 overflow-hidden",
              align === "left" ? "border-l-2 border-wu-accent" : "border-r-2 border-wu-accent text-right"
            )}>
              {/* Background HUD Graphics */}
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Wind size={120} className="text-wu-accent rotate-12" />
              </div>

              <div className={cn("flex items-center gap-3 mb-4", align === "right" && "justify-end")}>
                <div className="flex flex-col">
                  <span className="text-wu-accent font-mono text-[8px] uppercase tracking-[0.5em] font-black">
                    {subtitle}
                  </span>
                  <div className="flex gap-1 mt-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={cn("w-1 h-1 bg-wu-accent/20", i < 3 && "bg-wu-accent/60")} />
                    ))}
                  </div>
                </div>
                <div className="h-px w-8 bg-wu-accent/20" />
                <span className="text-[7px] text-white/30 font-mono italic">[{status}]</span>
              </div>

              <h3 className="text-4xl font-black uppercase tracking-tighter mb-6 text-white leading-[0.85]">
                {title}
              </h3>
              
              <div className="text-white/70 text-[11px] leading-relaxed space-y-4 font-medium">
                {children}
              </div>

              {/* Technical readout Footer */}
              <div className={cn("mt-8 pt-6 border-t border-white/5 flex items-center gap-4", align === "right" && "justify-end")}>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-wu-accent animate-pulse" />
                   <span className="text-[7px] font-mono text-white/40 tracking-widest uppercase">Encryption Active</span>
                </div>
                <div className="text-[7px] font-mono text-white/20 tracking-tighter flex gap-3">
                  <span>0x7F2A:001</span>
                  <span>SEQ_SYNC_OK</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Track the current frame in state for the fragments
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (latest) => {
      setCurrentFrame(Math.round(latest * 299));
    });
    return () => unsubscribe();
  }, [scrollYProgress]);
  
  return (
    <div className="relative min-h-[600vh] cursor-none" ref={containerRef}>
      <CustomCursor />
      <Navbar />
      
      {/* Background with Sequence Scroll */}
      <SequenceScroll frameCount={300} containerRef={containerRef} />

      {/* Hero Scroll Prompt */}
      <ScrollPrompt scrollYProgress={scrollYProgress} />

      {/* Dynamic HUD Fragments */}
      <ResonanceDataFragment 
        frame={currentFrame} 
        range={[55, 105]} 
        title="ROVER // 00" 
        subtitle="ENTITY_ARCHIVE_A1"
        status="RESONATING"
      >
        <p>A mysterious traveler awakened in a world where sound is the ultimate force. You carry the dual resonance of white and black, a rarity predicted by the Prophecy of Huanglong.</p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-1">
            <span className="text-[7px] uppercase text-white/30 block">Resonance Type</span>
            <span className="text-xs text-wu-accent font-black tracking-wider">SPECTRO / HAVOC</span>
          </div>
          <div className="space-y-1">
            <span className="text-[7px] uppercase text-white/30 block">Weapon Affinity</span>
            <span className="text-xs text-white font-bold">LONG BLADE</span>
          </div>
        </div>
      </ResonanceDataFragment>

      <ResonanceDataFragment 
        frame={currentFrame} 
        range={[135, 185]} 
        title="TACET FIELDS" 
        subtitle="THREAT_LEVEL_SEVERE"
        align="right"
        status="STRIKE_ZONE"
      >
        <p>Regions where reality thins and Tacet Discords materialize. Every encounter allows for the extraction of Echoes—capturing the essence of fallen enemies to enhance your own power.</p>
        <div className="flex gap-2 mt-4 justify-end">
          {[Zap, Shield, Ghost].map((Icon, i) => (
            <div key={i} className="w-10 h-10 border border-wu-accent/20 flex items-center justify-center bg-wu-accent/5">
              <Icon size={14} className="text-wu-accent" />
            </div>
          ))}
        </div>
      </ResonanceDataFragment>

      <ResonanceDataFragment 
        frame={currentFrame} 
        range={[215, 265]} 
        title="JINZHOU CITY" 
        subtitle="REGION_HUANGLONG"
        status="SECURE_NODE"
      >
        <p>The last bastion of human civilization in the Huanglong region. A fortress of high-technology and ancient tradition, standing against the encroaching silence of the Lament.</p>
        <div className="mt-4 h-12 w-full bg-white/5 border border-white/10 flex items-center px-4 overflow-hidden">
          <div className="flex gap-2 animate-scan-fast italic text-[8px] text-wu-accent/60 font-mono tracking-tighter">
            <span>UPDATING_MAP_DATA_POINTS...</span>
            <span>SCANNING_FOR_RESONATORS...</span>
          </div>
        </div>
      </ResonanceDataFragment>


      {/* Side Progress Indicator */}
      <div className="fixed right-4 md:right-8 top-1/2 -translate-y-1/2 z-[60] flex flex-col items-center gap-4">
        <div className="h-24 md:h-40 w-[1px] bg-white/10 relative">
          <motion.div 
            style={{ height: useTransform(useSpring(scrollYProgress, { stiffness: 100, damping: 30 }), [0, 1], ["0%", "100%"]) }}
            className="absolute top-0 left-0 w-full bg-wu-accent shadow-[0_0_10px_#22d3ee]"
          />
        </div>
        <span className="text-[6px] md:text-[8px] font-mono text-white/30 rotate-90 origin-left translate-x-1 translate-y-8 uppercase tracking-widest whitespace-nowrap">Resonance Sync</span>
      </div>

      {/* Vertical Overlay Content */}
      <div className="relative pointer-events-none">
        {/* Section 0: Hero */}
        <section className="h-screen flex flex-col items-center justify-center px-6 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 1.1 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false }}
              className="z-10"
            >
              <div className="mb-4 overflow-hidden">
                <span className="block text-[8px] md:text-[10px] uppercase tracking-[1.5em] text-white/40 mb-8 font-black">
                  Frequency: 440.0Hz // Beta Archive
                </span>
                <h1 className="text-[14vw] md:text-[120px] font-black leading-[0.8] tracking-[-0.07em] uppercase">
                  Wuthering<br/>
                  <span className="text-transparent text-outline opacity-60">Waves</span>
                </h1>
              </div>
            </motion.div>
          </section>

          {/* Spacer sections to sync with progress marks */}
          <section className="h-screen flex items-center justify-center">
            <div className="max-w-px h-full bg-white/5" />
          </section>
          <section className="h-screen" />
          <section className="h-screen" />
          <section className="h-screen" />

          {/* Section 3: Call to Action */}
          <section className="h-screen flex flex-col items-center justify-center px-6 text-center">
            <div className="pointer-events-auto relative">
              {/* Decorative HUD box */}
              <div className="absolute inset-x-[-4vw] inset-y-[-2vh] border border-wu-accent/10 pointer-events-none" />
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-wu-accent" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-wu-accent" />

              <h2 className="text-7xl md:text-[9vw] font-black uppercase tracking-tighter mb-4 leading-none mix-blend-difference">
                RECLAIM THE<br />
                <span className="text-wu-accent italic">FUTURE</span>
              </h2>
              <div className="pt-2 pb-12">
                <span className="text-[9px] uppercase tracking-[1em] text-white/30 font-black">Global Launch Archive</span>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                <button className="relative group px-16 py-6 bg-white overflow-hidden transition-all duration-300 transform hover:scale-105 active:scale-95">
                  <div className="absolute inset-0 bg-wu-accent translate-x-[-101%] group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                  <span className="relative z-10 text-black font-black uppercase tracking-[0.4em] text-[10px] group-hover:text-black">
                    ENTER HUANGLONG
                  </span>
                </button>
                <div className="group cursor-pointer flex flex-col items-center gap-2">
                  <span className="text-[8px] font-mono text-white/30 uppercase tracking-[0.3em]">Version 1.0.4</span>
                  <div className="w-12 h-px bg-white/10 group-hover:bg-wu-accent transition-colors" />
                </div>
              </div>
            </div>
          </section>
      </div>

      <style>{`
        .text-outline {
          -webkit-text-stroke: 1px rgba(255, 255, 255, 0.4);
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.2; transform: scale(1.1); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s infinite ease-in-out;
        }
        @keyframes glitch-line {
          0% { transform: scaleX(0); opacity: 0; }
          40% { transform: scaleX(1); opacity: 1; }
          60% { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(0); opacity: 0; }
        }
        .animate-glitch-line {
          animation: glitch-line 4s infinite ease-in-out;
        }
        @keyframes scan-fast {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scan-fast {
          animation: scan-fast 10s linear infinite;
          white-space: nowrap;
          width: 200%;
        }
      `}</style>
    </div>
  );
}

