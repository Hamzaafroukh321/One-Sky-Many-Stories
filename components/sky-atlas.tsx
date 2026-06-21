"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./sky-atlas.module.css";

type Culture = {
  id: string;
  label: string;
  region: string;
  accent: string;
  line: string;
};

const cultures: Culture[] = [
  {
    id: "greek",
    label: "Greek",
    region: "Europe",
    accent: "#E8D9A0",
    line: "#C9B66E",
  },
  {
    id: "chinese",
    label: "Chinese",
    region: "East Asia",
    accent: "#E4434B",
    line: "#D98C2B",
  },
  {
    id: "polynesian",
    label: "Polynesian",
    region: "Pacific",
    accent: "#34C7C2",
    line: "#F0876A",
  },
];

function formatRa(ra: number) {
  const hours = Math.floor(ra);
  const minutes = Math.round((ra - hours) * 60);
  return `${String(hours).padStart(2, "0")}h${String(minutes).padStart(2, "0")}m`;
}

function formatDec(dec: number) {
  const sign = dec >= 0 ? "+" : "-";
  return `${sign}${Math.abs(Math.round(dec))}deg`;
}

export function SkyAtlas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeCultureId, setActiveCultureId] = useState("greek");
  const [center, setCenter] = useState({ ra: 6.5, dec: 12 });
  const activeCulture = useMemo(
    () => cultures.find((culture) => culture.id === activeCultureId) ?? cultures[0],
    [activeCultureId],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    const pixelRatio = window.devicePixelRatio || 1;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const render = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#05060A";
      context.fillRect(0, 0, width, height);

      const gradient = context.createRadialGradient(
        width * 0.5,
        height * 0.42,
        0,
        width * 0.5,
        height * 0.45,
        Math.max(width, height) * 0.68,
      );
      gradient.addColorStop(0, "rgba(22, 27, 42, 0.74)");
      gradient.addColorStop(0.48, "rgba(11, 14, 22, 0.56)");
      gradient.addColorStop(1, "rgba(5, 6, 10, 1)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      const starCount = 220;
      for (let index = 0; index < starCount; index += 1) {
        const seed = Math.sin(index * 997.31) * 10000;
        const x = (seed - Math.floor(seed)) * width;
        const seedTwo = Math.sin(index * 421.17) * 10000;
        const y = (seedTwo - Math.floor(seedTwo)) * height;
        const pulse = 0.75 + Math.sin(time * 0.0008 + index) * 0.1;
        const radius = index % 17 === 0 ? 1.8 : index % 7 === 0 ? 1.1 : 0.55;

        context.beginPath();
        context.fillStyle = `rgba(237, 239, 247, ${pulse})`;
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      animationFrame = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    animationFrame = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <main
      className={styles.shell}
      style={
        {
          "--accent": activeCulture.accent,
          "--line": activeCulture.line,
        } as React.CSSProperties
      }
    >
      <canvas ref={canvasRef} className={styles.sky} aria-hidden="true" />
      <header className={styles.topBar}>
        <div className={styles.wordmark}>ONE SKY &middot; MANY STORIES</div>
        <div className={styles.readout} aria-live="polite">
          RA {formatRa(center.ra)} <span>DEC {formatDec(center.dec)}</span>
        </div>
        <div className={styles.actions}>
          <button className={styles.textButton} type="button">
            Compare
          </button>
          <button className={styles.iconButton} type="button" aria-label="Open sources">
            ?
          </button>
        </div>
      </header>

      <section className={styles.intro} aria-label="Current sky culture">
        <p>{activeCulture.region}</p>
        <h1>{activeCulture.label}</h1>
        <span>The stars don't move. The stories do.</span>
      </section>

      <nav className={styles.rail} aria-label="Sky cultures">
        {cultures.map((culture) => (
          <button
            key={culture.id}
            className={styles.cultureChip}
            data-active={culture.id === activeCultureId}
            style={{ "--chip-line": culture.line } as React.CSSProperties}
            type="button"
            onClick={() => setActiveCultureId(culture.id)}
          >
            {culture.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
