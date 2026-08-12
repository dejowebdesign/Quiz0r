"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";
import { LanguageSelector } from "@/components/ui/language-selector";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

// Large pool of quiz-related emoji
const emojiPool = [
  "❓", "💡", "📚", "🎓", "🏆", "⭐", "💭", "🎲", "🧠", "⚡",
  "🎯", "✨", "🔥", "💯", "🌟", "🎉", "🤔", "📝", "🎊", "💪",
  "🚀", "✅", "🔮", "📖", "🎮", "🏅", "💎", "🌈", "⏰", "🎁",
  "🔔", "💥", "🎵", "🎤", "📊", "🎨", "🧩", "🔑", "💫", "🌸",
];

// Generate emoji with positions based on screen size
function generateEmoji(isLargeScreen: boolean) {
  // More emoji on larger screens to fill space
  const count = isLargeScreen ? 35 : 20;

  // Define exclusion zone for center content (title, tagline, button)
  // and footer - with margin around text
  const exclusionZones = [
    // Center content area with margin
    { xMin: 20, xMax: 80, yMin: 25, yMax: 75 },
    // Footer area
    { xMin: 25, xMax: 75, yMin: 88, yMax: 100 },
  ];

  const isInExclusionZone = (x: number, y: number) => {
    return exclusionZones.some(
      (zone) => x > zone.xMin && x < zone.xMax && y > zone.yMin && y < zone.yMax
    );
  };

  const positions: { emoji: string; x: number; y: number; size: number; mouseSpeed: number }[] = [];

  // Create a denser grid
  const cols = isLargeScreen ? 8 : 5;
  const rows = isLargeScreen ? 7 : 5;

  let emojiIndex = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (positions.length >= count) break;

      // Calculate base position
      let x = ((col + 0.5) / cols) * 100;
      let y = ((row + 0.5) / rows) * 92 + 4; // 4-96% range

      // Add slight randomness for organic feel
      x += Math.sin(emojiIndex * 2.1) * 6;
      y += Math.cos(emojiIndex * 1.8) * 4;

      // Clamp to screen bounds with comfortable margin from edges
      x = Math.max(8, Math.min(92, x));
      y = Math.max(8, Math.min(88, y));

      // Skip if in exclusion zone
      if (isInExclusionZone(x, y)) {
        emojiIndex++;
        continue;
      }

      // Vary sizes slightly
      const size = 1.8 + Math.sin(emojiIndex * 1.3) * 0.4;
      const mouseSpeed = 0.03 + Math.cos(emojiIndex * 0.7) * 0.015;

      positions.push({
        emoji: emojiPool[emojiIndex % emojiPool.length],
        x,
        y,
        size,
        mouseSpeed,
      });

      emojiIndex++;
    }
  }

  return positions;
}

export default function Home() {
  const { t } = useTranslation();
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isMouseOnScreen, setIsMouseOnScreen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setIsMouseOnScreen(true);
      setMousePos({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };

    const handleMouseLeave = (e: MouseEvent) => {
      if (
        e.clientY <= 0 ||
        e.clientX <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        setIsMouseOnScreen(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Dark mode toggle + language selector in top-right */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <LanguageSelector className="w-[140px]" />
        <DarkModeToggle showLabel={false} />
      </div>

      {/* Gradient background - warm colors */}
      <div className="gradient-bg" />

      {/* Floating Quiz Emoji - responsive positioning */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
        {useMemo(() => generateEmoji(isLargeScreen), [isLargeScreen]).map((item, i) => {
          const emojiX = item.x / 100;
          const emojiY = item.y / 100;
          const pullStrength = 80 * item.mouseSpeed;
          const rawPullX = isMouseOnScreen ? (mousePos.x - emojiX) * pullStrength : 0;
          const rawPullY = isMouseOnScreen ? (mousePos.y - emojiY) * pullStrength : 0;
          const maxPull = 30;
          const pullX = Math.max(-maxPull, Math.min(maxPull, rawPullX));
          const pullY = Math.max(-maxPull, Math.min(maxPull, rawPullY));

          return (
            <span
              key={i}
              className="emoji-float-wrapper"
              style={{
                position: "absolute",
                left: `${item.x}%`,
                top: `${item.y}%`,
                animationDelay: `${i * 0.3}s`,
              }}
            >
              <span
                className="floating-emoji-interactive"
                style={{
                  fontSize: `${item.size}rem`,
                  transform: `translate(${pullX}px, ${pullY}px)`,
                }}
              >
                {item.emoji}
              </span>
            </span>
          );
        })}
      </div>

      {/* Content - centered */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center hero-float">
          <div className="flex items-center justify-center gap-2 mb-6 fade-in-up">
            <span className="text-sm font-medium text-muted-foreground bg-muted px-4 py-1.5 rounded-full">
              {t("app.badge")}
            </span>
          </div>

          <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold mb-6 tracking-tight gradient-text title-glow fade-in-up-delay-1">
            Quiz0r
          </h1>

          <p className="text-xl sm:text-2xl text-muted-foreground max-w-xl mx-auto mb-12 fade-in-up-delay-2">
            {t("app.tagline")}
          </p>

          <div className="fade-in-up-delay-2">
            <Button
              asChild
              size="lg"
              className="text-lg px-10 py-7 min-w-[200px] bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Link href="/menu" className="flex items-center gap-2">
                {t("app.continue")}
                <ChevronRight className="w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 text-center text-sm text-muted-foreground fade-in-up-delay-2">
          <p>
            {t("app.builtBy")}{" "}
            <a
              href="https://err0r.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Err0r.dev
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
