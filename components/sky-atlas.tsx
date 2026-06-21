"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, Pin, RotateCcw, X } from "lucide-react";
import styles from "./sky-atlas.module.css";

type StarTuple = [number, string, number, number, number, number];

type Star = {
  hip: number;
  proper: string;
  ra: number;
  dec: number;
  mag: number;
  ci: number;
  x: number;
  y: number;
  z: number;
  phase: number;
};

type Constellation = {
  id: string;
  name: string;
  nativeName: string;
  romanization: string;
  lines: number[][];
  myth: string;
};

type Culture = {
  id: string;
  label: string;
  region: string;
  accent: string;
  line: string;
  license: string;
  source: string;
  constellations: Constellation[];
};

type ProjectedPoint = {
  x: number;
  y: number;
  visible: boolean;
};

type ViewState = {
  ra: number;
  dec: number;
  zoom: number;
};

const cultureIds = ["greek", "chinese", "polynesian"];
const defaultView: ViewState = { ra: 6.5, dec: 10, zoom: 520 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrapRa(ra: number) {
  return ((ra % 24) + 24) % 24;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgba(hex: string, alpha: number) {
  const color = hexToRgb(hex);
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function starTint(ci: number, alpha: number) {
  const t = clamp((ci + 0.3) / 2.3, 0, 1);
  const cool = { r: 207, g: 224, b: 255 };
  const warm = { r: 255, g: 218, b: 159 };
  const r = Math.round(cool.r + (warm.r - cool.r) * t);
  const g = Math.round(cool.g + (warm.g - cool.g) * t);
  const b = Math.round(cool.b + (warm.b - cool.b) * t);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toStar(tuple: StarTuple, index: number): Star {
  const [, , ra, dec] = tuple;
  const raRad = ra * (Math.PI / 12);
  const decRad = dec * (Math.PI / 180);

  return {
    hip: tuple[0],
    proper: tuple[1],
    ra,
    dec,
    mag: tuple[4],
    ci: tuple[5],
    x: Math.cos(decRad) * Math.cos(raRad),
    y: Math.cos(decRad) * Math.sin(raRad),
    z: Math.sin(decRad),
    phase: (index * 1.61803398875) % (Math.PI * 2),
  };
}

function projectStar(star: Star, view: ViewState, width: number, height: number): ProjectedPoint {
  const centerRa = view.ra * (Math.PI / 12);
  const centerDec = view.dec * (Math.PI / 180);
  const centerX = Math.cos(centerDec) * Math.cos(centerRa);
  const centerY = Math.cos(centerDec) * Math.sin(centerRa);
  const centerZ = Math.sin(centerDec);
  const eastX = -Math.sin(centerRa);
  const eastY = Math.cos(centerRa);
  const northX = -Math.sin(centerDec) * Math.cos(centerRa);
  const northY = -Math.sin(centerDec) * Math.sin(centerRa);
  const northZ = Math.cos(centerDec);
  const rx = star.x * eastX + star.y * eastY;
  const ry = star.x * northX + star.y * northY + star.z * northZ;
  const rz = star.x * centerX + star.y * centerY + star.z * centerZ;

  if (rz <= -0.999) {
    return { x: 0, y: 0, visible: false };
  }

  const k = 1 / (1 + rz);
  return {
    x: width / 2 + rx * k * view.zoom,
    y: height / 2 - ry * k * view.zoom,
    visible: true,
  };
}

function formatRa(ra: number) {
  const wrapped = wrapRa(ra);
  const hours = Math.floor(wrapped);
  const minutes = Math.round((wrapped - hours) * 60);
  return `${String(hours).padStart(2, "0")}h${String(minutes).padStart(2, "0")}m`;
}

function formatDec(dec: number) {
  const sign = dec >= 0 ? "+" : "-";
  return `${sign}${Math.abs(Math.round(dec))}deg`;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function drawProgressPath(
  context: CanvasRenderingContext2D,
  points: ProjectedPoint[],
  progress: number,
) {
  const visible = points.filter((point) => point.visible);

  if (visible.length < 2) {
    return;
  }

  const lengths: number[] = [];
  let total = 0;
  for (let index = 1; index < visible.length; index += 1) {
    const length = Math.hypot(visible[index].x - visible[index - 1].x, visible[index].y - visible[index - 1].y);
    lengths.push(length);
    total += length;
  }

  const target = total * clamp(progress, 0, 1);
  let traveled = 0;
  context.beginPath();
  context.moveTo(visible[0].x, visible[0].y);

  for (let index = 1; index < visible.length; index += 1) {
    const segmentLength = lengths[index - 1];

    if (traveled + segmentLength <= target) {
      context.lineTo(visible[index].x, visible[index].y);
      traveled += segmentLength;
    } else {
      const remaining = Math.max(0, target - traveled);
      const amount = segmentLength === 0 ? 0 : remaining / segmentLength;
      const previous = visible[index - 1];
      const current = visible[index];
      context.lineTo(
        previous.x + (current.x - previous.x) * amount,
        previous.y + (current.y - previous.y) * amount,
      );
      break;
    }
  }

  context.stroke();
}

function constellationCentroid(
  constellation: Constellation,
  starsByHip: Map<number, Star>,
  view: ViewState,
  width: number,
  height: number,
) {
  const points = constellation.lines
    .flatMap((line) => line)
    .map((hip) => starsByHip.get(hip))
    .filter((star): star is Star => Boolean(star))
    .map((star) => projectStar(star, view, width, height))
    .filter((point) => point.visible);

  if (points.length === 0) {
    return null;
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

export function SkyAtlas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<ViewState>(defaultView);
  const dragRef = useRef<{ x: number; y: number; view: ViewState } | null>(null);
  const transitionRef = useRef<{ from: string; to: string; startedAt: number } | null>(null);
  const [stars, setStars] = useState<Star[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [activeCultureId, setActiveCultureId] = useState("greek");
  const [pinnedCultureId, setPinnedCultureId] = useState<string | null>(null);
  const [selectedConstellationId, setSelectedConstellationId] = useState<string | null>(null);
  const [hoveredConstellationId, setHoveredConstellationId] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [viewReadout, setViewReadout] = useState(defaultView);
  const [reducedMotion, setReducedMotion] = useState(false);

  const activeCulture = useMemo(
    () => cultures.find((culture) => culture.id === activeCultureId) ?? cultures[0],
    [activeCultureId, cultures],
  );
  const pinnedCulture = useMemo(
    () => cultures.find((culture) => culture.id === pinnedCultureId) ?? null,
    [pinnedCultureId, cultures],
  );
  const selectedConstellation = useMemo(
    () =>
      activeCulture?.constellations.find(
        (constellation) => constellation.id === selectedConstellationId,
      ) ?? null,
    [activeCulture, selectedConstellationId],
  );
  const starsByHip = useMemo(() => new Map(stars.map((star) => [star.hip, star])), [stars]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let canceled = false;

    async function loadData() {
      const [starTuples, ...culturePayloads] = await Promise.all([
        fetch("/data/stars.json").then((response) => response.json()) as Promise<StarTuple[]>,
        ...cultureIds.map((id) =>
          fetch(`/data/cultures/${id}.json`).then((response) => response.json()) as Promise<Culture>,
        ),
      ]);

      if (canceled) {
        return;
      }

      setStars(starTuples.map(toStar));
      setCultures(culturePayloads);
    }

    loadData().catch((error) => {
      console.error("Unable to load sky data", error);
    });

    return () => {
      canceled = true;
    };
  }, []);

  const findConstellationAt = useCallback(
    (x: number, y: number, culture: Culture | undefined) => {
      const canvas = canvasRef.current;
      if (!canvas || !culture) {
        return null;
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      let best: { id: string; distance: number } | null = null;

      for (const constellation of culture.constellations) {
        for (const line of constellation.lines) {
          const points = line
            .map((hip) => starsByHip.get(hip))
            .filter((star): star is Star => Boolean(star))
            .map((star) => projectStar(star, viewRef.current, width, height))
            .filter((point) => point.visible);

          for (let index = 1; index < points.length; index += 1) {
            const distance = distanceToSegment(
              x,
              y,
              points[index - 1].x,
              points[index - 1].y,
              points[index].x,
              points[index].y,
            );

            if (distance < 14 && (!best || distance < best.distance)) {
              best = { id: constellation.id, distance };
            }
          }
        }
      }

      return best?.id ?? null;
    },
    [starsByHip],
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
    let lastReadout = 0;

    const resize = () => {
      const pixelRatio = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const drawCulture = (
      culture: Culture,
      options: { alpha: number; progress: number; ghost?: boolean },
    ) => {
      const lineColor = options.ghost ? "#8A91A6" : culture.line;
      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";

      for (const constellation of culture.constellations) {
        const hovered = constellation.id === hoveredConstellationId;
        const dimmed = hoveredConstellationId && !hovered && !options.ghost;
        context.strokeStyle = rgba(lineColor, options.alpha * (dimmed ? 0.36 : hovered ? 1 : 0.74));
        context.lineWidth = options.ghost ? 1 : hovered ? 2.4 : 1.35;

        for (const line of constellation.lines) {
          const points = line
            .map((hip) => starsByHip.get(hip))
            .filter((star): star is Star => Boolean(star))
            .map((star) => projectStar(star, viewRef.current, width, height));
          drawProgressPath(context, points, options.progress);
        }

        if (hovered && !options.ghost) {
          const centroid = constellationCentroid(constellation, starsByHip, viewRef.current, width, height);
          if (centroid) {
            context.font = "12px var(--font-space-mono)";
            context.fillStyle = rgba(culture.accent, 0.95);
            context.fillText(constellation.name.toUpperCase(), centroid.x + 12, centroid.y - 12);
          }
        }
      }

      context.restore();
    };

    const render = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#05060A";
      context.fillRect(0, 0, width, height);

      const skyGradient = context.createRadialGradient(
        width * 0.5,
        height * 0.42,
        0,
        width * 0.5,
        height * 0.45,
        Math.max(width, height) * 0.72,
      );
      skyGradient.addColorStop(0, "rgba(22, 27, 42, 0.74)");
      skyGradient.addColorStop(0.52, "rgba(11, 14, 22, 0.54)");
      skyGradient.addColorStop(1, "rgba(5, 6, 10, 1)");
      context.fillStyle = skyGradient;
      context.fillRect(0, 0, width, height);

      if (!reducedMotion && !dragRef.current) {
        viewRef.current = {
          ...viewRef.current,
          ra: wrapRa(viewRef.current.ra + 0.000018),
        };
      }

      for (const star of stars) {
        const point = projectStar(star, viewRef.current, width, height);
        if (!point.visible || point.x < -24 || point.x > width + 24 || point.y < -24 || point.y > height + 24) {
          continue;
        }

        const radius = Math.max(0.35, (6.5 - star.mag) * 0.45);
        const baseAlpha = Math.min(1, Math.max(0.25, (6.5 - star.mag) / 7));
        const twinkle = reducedMotion ? 1 : 0.92 + Math.sin(time * 0.001 + star.phase) * 0.08;
        const alpha = baseAlpha * twinkle;

        if (radius > 1.25) {
          const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 5.2);
          glow.addColorStop(0, starTint(star.ci, alpha * 0.58));
          glow.addColorStop(1, "rgba(237, 239, 247, 0)");
          context.fillStyle = glow;
          context.beginPath();
          context.arc(point.x, point.y, radius * 5.2, 0, Math.PI * 2);
          context.fill();
        }

        context.fillStyle = starTint(star.ci, alpha);
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();
      }

      if (pinnedCulture && pinnedCulture.id !== activeCulture?.id) {
        drawCulture(pinnedCulture, { alpha: 0.25, progress: 1, ghost: true });
      }

      if (activeCulture) {
        const transition = transitionRef.current;
        if (!transition || reducedMotion) {
          drawCulture(activeCulture, { alpha: 1, progress: 1 });
        } else {
          const elapsed = time - transition.startedAt;
          const outgoing = cultures.find((culture) => culture.id === transition.from);
          const incoming = cultures.find((culture) => culture.id === transition.to);

          if (outgoing && elapsed < 350) {
            drawCulture(outgoing, { alpha: 1 - elapsed / 350, progress: 1 - elapsed / 350 });
          }

          if (incoming && elapsed >= 430) {
            drawCulture(incoming, { alpha: 1, progress: clamp((elapsed - 430) / 450, 0, 1) });
          }

          if (elapsed > 900) {
            transitionRef.current = null;
          }
        }
      }

      if (time - lastReadout > 160) {
        lastReadout = time;
        setViewReadout(viewRef.current);
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
  }, [
    activeCulture,
    cultures,
    hoveredConstellationId,
    pinnedCulture,
    reducedMotion,
    stars,
    starsByHip,
  ]);

  const setCulture = (cultureId: string) => {
    if (cultureId === activeCultureId) {
      return;
    }

    transitionRef.current = {
      from: activeCultureId,
      to: cultureId,
      startedAt: performance.now(),
    };
    setSelectedConstellationId(null);
    setHoveredConstellationId(null);
    setActiveCultureId(cultureId);
  };

  const resetView = () => {
    viewRef.current = { ...defaultView };
    setViewReadout(defaultView);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      view: { ...viewRef.current },
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const drag = dragRef.current;
      const next = {
        ...drag.view,
        ra: wrapRa(drag.view.ra - ((event.clientX - drag.x) / drag.view.zoom) * 4.2),
        dec: clamp(drag.view.dec + ((event.clientY - drag.y) / drag.view.zoom) * 52, -72, 72),
      };
      viewRef.current = next;
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredConstellationId(findConstellationAt(event.clientX - rect.left, event.clientY - rect.top, activeCulture));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;

    if (!drag) {
      return;
    }

    const moved = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
    if (moved < 4) {
      const rect = event.currentTarget.getBoundingClientRect();
      const constellationId = findConstellationAt(event.clientX - rect.left, event.clientY - rect.top, activeCulture);
      setSelectedConstellationId(constellationId);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? 0.9 : 1.1;
    viewRef.current = {
      ...viewRef.current,
      zoom: clamp(viewRef.current.zoom * direction, 280, 1150),
    };
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedConstellationId(null);
        setShowSources(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main
      className={styles.shell}
      style={
        {
          "--accent": activeCulture?.accent ?? "#E8D9A0",
          "--line": activeCulture?.line ?? "#C9B66E",
        } as React.CSSProperties
      }
    >
      <canvas
        ref={canvasRef}
        className={styles.sky}
        aria-label="Interactive star map"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredConstellationId(null)}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />
      <header className={styles.topBar}>
        <div className={styles.wordmark}>ONE SKY &middot; MANY STORIES</div>
        <div className={styles.readout} aria-live="polite">
          RA {formatRa(viewReadout.ra)} <span>DEC {formatDec(viewReadout.dec)}</span>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Reset sky view"
            title="Reset view"
            onClick={resetView}
          >
            <RotateCcw aria-hidden="true" size={15} strokeWidth={1.8} />
          </button>
          <button
            className={styles.textButton}
            type="button"
            aria-pressed={Boolean(pinnedCultureId)}
            title="Pin this culture for comparison"
            onClick={() => setPinnedCultureId(pinnedCultureId ? null : activeCultureId)}
          >
            <Pin aria-hidden="true" size={14} strokeWidth={1.8} />
            <span>Compare</span>
          </button>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Open sources"
            title="Sources"
            onClick={() => setShowSources(true)}
          >
            <CircleHelp aria-hidden="true" size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <section className={styles.intro} aria-label="Current sky culture">
        <p>{activeCulture?.region ?? "Loading"}</p>
        <h1>{activeCulture?.label ?? "Sky"}</h1>
        <span>The stars don't move. The stories do.</span>
      </section>

      {pinnedCulture && activeCulture && pinnedCulture.id !== activeCulture.id ? (
        <div className={styles.compareLegend}>
          <span>Ghost {pinnedCulture.label}</span>
          <span>Active {activeCulture.label}</span>
        </div>
      ) : null}

      <aside className={styles.storyPanel} data-open={Boolean(selectedConstellation)}>
        {selectedConstellation && activeCulture ? (
          <>
            <button
              className={styles.closeButton}
              type="button"
              aria-label="Close story panel"
              onClick={() => setSelectedConstellationId(null)}
            >
              <X aria-hidden="true" size={16} strokeWidth={1.8} />
            </button>
            <p className={styles.eyebrow}>Constellation &middot; {activeCulture.region}</p>
            <h2>{selectedConstellation.name}</h2>
            <p className={styles.nativeName}>
              {[selectedConstellation.nativeName, selectedConstellation.romanization]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className={styles.rule} />
            <p className={styles.myth}>{selectedConstellation.myth}</p>
            <footer className={styles.sourceBlock}>
              <strong>Source</strong>
              <span>{activeCulture.source}</span>
              <span>{activeCulture.license}</span>
            </footer>
          </>
        ) : (
          <p className={styles.emptyState}>
            Pick a culture below. Then tap any figure in the sky to hear how they read it.
          </p>
        )}
      </aside>

      {showSources ? (
        <section className={styles.sourcesPanel} aria-label="About and sources">
          <button
            className={styles.closeButton}
            type="button"
            aria-label="Close sources"
            onClick={() => setShowSources(false)}
          >
            <X aria-hidden="true" size={16} strokeWidth={1.8} />
          </button>
          <p className={styles.eyebrow}>About &middot; Sources</p>
          <h2>The stars don't move. The stories do.</h2>
          <p>
            The same photons hit every human eye, but every culture drew its own lines between
            them. This is a small atlas of that disagreement: one physical sky, many inherited
            ways of reading it.
          </p>
          <p>
            Star positions: HYG Database by David Nash / astronexus (CC BY-SA 4.0).
            Constellation figures and myths: Stellarium Sky Cultures and the constellation-lines
            dataset by Doina Bucur (Creative Commons). This project is non-commercial and
            educational.
          </p>
        </section>
      ) : null}

      <nav className={styles.rail} aria-label="Sky cultures">
        {cultures.map((culture) => (
          <button
            key={culture.id}
            className={styles.cultureChip}
            data-active={culture.id === activeCultureId}
            style={{ "--chip-line": culture.line } as React.CSSProperties}
            type="button"
            onClick={() => setCulture(culture.id)}
          >
            {culture.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
