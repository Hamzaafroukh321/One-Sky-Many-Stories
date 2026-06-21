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
  image?: {
    src: string;
    size: [number, number];
    anchors: Array<{ imgX: number; imgY: number; hip: number }>;
  };
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

type HoverTarget = {
  id: string;
  name: string;
  nativeName: string;
  x: number;
  y: number;
};

type CultureSwitchNotice = {
  id: number;
  from: string;
  to: string;
};

const cultureIds = ["greek", "chinese", "polynesian"];
const defaultView: ViewState = { ra: 12.77, dec: 7, zoom: 340 };
const SWITCH_RETRACT_MS = 300;
const SWITCH_GAP_MS = 70;
const SWITCH_GROW_MS = 400;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrapRa(ra: number) {
  return ((ra % 24) + 24) % 24;
}

function easeOutCubic(value: number) {
  const t = clamp(value, 0, 1);
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(value: number) {
  const t = clamp(value, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
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

function ciToRgb(ci: number) {
  const t = clamp((ci + 0.3) / 1.8, 0, 1);
  const cool = { r: 207, g: 224, b: 255 };
  const warm = { r: 255, g: 218, b: 159 };
  return {
    r: Math.round(cool.r + (warm.r - cool.r) * t),
    g: Math.round(cool.g + (warm.g - cool.g) * t),
    b: Math.round(cool.b + (warm.b - cool.b) * t),
  };
}

function starTint(ci: number, alpha: number) {
  const { r, g, b } = ciToRgb(ci);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawStar(context: CanvasRenderingContext2D, x: number, y: number, mag: number, ci: number, alpha = 1) {
  const brightness = clamp((6.5 - mag) / 8, 0, 1);
  const coreRadius = Math.max(0.45, brightness * 1.45);

  if (mag >= 4.25) {
    context.fillStyle = `rgba(237, 239, 247, ${0.28 * alpha + 0.28 * brightness * alpha})`;
    context.beginPath();
    context.arc(x, y, coreRadius, 0, Math.PI * 2);
    context.fill();
    return;
  }

  const haloRadius = coreRadius * (3 + brightness * 4);
  const color = ciToRgb(ci);
  const halo = context.createRadialGradient(x, y, 0, x, y, haloRadius);

  halo.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.26 * brightness * alpha})`);
  halo.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.06 * brightness * alpha})`);
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = halo;
  context.beginPath();
  context.arc(x, y, haloRadius, 0, Math.PI * 2);
  context.fill();

  if (mag < 1.6) {
    const bloomRadius = haloRadius * 2.2;
    const bloom = context.createRadialGradient(x, y, 0, x, y, bloomRadius);
    bloom.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.09 * alpha})`);
    bloom.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = bloom;
    context.beginPath();
    context.arc(x, y, bloomRadius, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = `rgba(245, 247, 252, ${(0.65 + 0.35 * brightness) * alpha})`;
  context.beginPath();
  context.arc(x, y, coreRadius, 0, Math.PI * 2);
  context.fill();
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
  const zoom = viewportZoom(view, width, height);
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
    x: width / 2 + rx * k * zoom,
    y: height / 2 - ry * k * zoom,
    visible: true,
  };
}

function createProjector(view: ViewState, width: number, height: number) {
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
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const zoom = viewportZoom(view, width, height);

  return (star: Star): ProjectedPoint => {
    const rx = star.x * eastX + star.y * eastY;
    const ry = star.x * northX + star.y * northY + star.z * northZ;
    const rz = star.x * centerX + star.y * centerY + star.z * centerZ;

    if (rz <= -0.999) {
      return { x: 0, y: 0, visible: false };
    }

    const k = 1 / (1 + rz);
    return {
      x: halfWidth + rx * k * zoom,
      y: halfHeight - ry * k * zoom,
      visible: true,
    };
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

function viewportZoom(view: ViewState, width: number, height: number) {
  const scale = clamp(Math.min(width / 1440, height / 900), 0.55, 1.1);
  return view.zoom * scale;
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

function constellationHipSet(constellation: Constellation) {
  return new Set(constellation.lines.flatMap((line) => line));
}

function cultureHipSet(culture: Culture | undefined) {
  return new Set(culture?.constellations.flatMap((constellation) => constellation.lines.flat()) ?? []);
}

function affineFromThreePoints(
  source: Array<{ x: number; y: number }>,
  target: Array<{ x: number; y: number }>,
) {
  const [s1, s2, s3] = source;
  const [t1, t2, t3] = target;
  const denominator =
    s1.x * (s2.y - s3.y) +
    s2.x * (s3.y - s1.y) +
    s3.x * (s1.y - s2.y);

  if (Math.abs(denominator) < 0.0001) {
    return null;
  }

  const a =
    (t1.x * (s2.y - s3.y) + t2.x * (s3.y - s1.y) + t3.x * (s1.y - s2.y)) /
    denominator;
  const c =
    (t1.x * (s3.x - s2.x) + t2.x * (s1.x - s3.x) + t3.x * (s2.x - s1.x)) /
    denominator;
  const e =
    (t1.x * (s2.x * s3.y - s3.x * s2.y) +
      t2.x * (s3.x * s1.y - s1.x * s3.y) +
      t3.x * (s1.x * s2.y - s2.x * s1.y)) /
    denominator;
  const b =
    (t1.y * (s2.y - s3.y) + t2.y * (s3.y - s1.y) + t3.y * (s1.y - s2.y)) /
    denominator;
  const d =
    (t1.y * (s3.x - s2.x) + t2.y * (s1.x - s3.x) + t3.y * (s2.x - s1.x)) /
    denominator;
  const f =
    (t1.y * (s2.x * s3.y - s3.x * s2.y) +
      t2.y * (s3.x * s1.y - s1.x * s3.y) +
      t3.y * (s1.x * s2.y - s2.x * s1.y)) /
    denominator;

  return { a, b, c, d, e, f };
}

export function SkyAtlas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<ViewState>(defaultView);
  const dragRef = useRef<{ x: number; y: number; view: ViewState } | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const transitionRef = useRef<{ from: string; to: string; startedAt: number; sharedHips: number[] } | null>(null);
  const ignitionStartedAtRef = useRef<number | null>(null);
  const illustrationCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const maskedIllustrationCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const heldSharedTimeoutRef = useRef<number | null>(null);
  const [stars, setStars] = useState<Star[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [activeCultureId, setActiveCultureId] = useState("greek");
  const [pinnedCultureId, setPinnedCultureId] = useState<string | null>(null);
  const [selectedConstellationId, setSelectedConstellationId] = useState<string | null>(null);
  const [hoveredConstellationId, setHoveredConstellationId] = useState<string | null>(null);
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [viewReadout, setViewReadout] = useState(defaultView);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [skyReady, setSkyReady] = useState(false);
  const [hasExplored, setHasExplored] = useState(false);
  const [cultureSwitchNotice, setCultureSwitchNotice] = useState<CultureSwitchNotice | null>(null);
  const [focusedSharedHips, setFocusedSharedHips] = useState<number[]>([]);
  const [heldSharedHips, setHeldSharedHips] = useState<number[]>([]);

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
  const hoveredConstellation = useMemo(
    () =>
      activeCulture?.constellations.find(
        (constellation) => constellation.id === hoveredConstellationId,
      ) ?? null,
    [activeCulture, hoveredConstellationId],
  );
  const selectedHips = useMemo(
    () => (selectedConstellation ? constellationHipSet(selectedConstellation) : new Set<number>()),
    [selectedConstellation],
  );
  const hoveredHips = useMemo(
    () => (hoveredConstellation ? constellationHipSet(hoveredConstellation) : new Set<number>()),
    [hoveredConstellation],
  );
  const starsByHip = useMemo(() => new Map(stars.map((star) => [star.hip, star])), [stars]);
  const overlapInsights = useMemo(() => {
    if (!selectedConstellation || !activeCulture) {
      return [];
    }

    const selectedStars = constellationHipSet(selectedConstellation);

    return cultures
      .filter((culture) => culture.id !== activeCulture.id)
      .flatMap((culture) =>
        culture.constellations.map((constellation) => {
          const overlap = [...constellationHipSet(constellation)].filter((hip) => selectedStars.has(hip));
          return {
            cultureId: culture.id,
            culture: culture.label,
            constellationId: constellation.id,
            name: constellation.name,
            count: overlap.length,
            sharedHips: overlap,
          };
        }),
      )
      .filter((item) => item.count >= 2)
      .sort((first, second) => second.count - first.count)
      .slice(0, 3);
  }, [activeCulture, cultures, selectedConstellation]);
  const disagreementHips = useMemo(() => {
    if (!activeCulture || !pinnedCulture || activeCulture.id === pinnedCulture.id) {
      return new Set<number>();
    }

    const activeHips = new Set(activeCulture.constellations.flatMap((constellation) => constellation.lines.flat()));
    const pinnedHips = new Set(pinnedCulture.constellations.flatMap((constellation) => constellation.lines.flat()));
    return new Set([...activeHips].filter((hip) => pinnedHips.has(hip)));
  }, [activeCulture, pinnedCulture]);
  const activePulseHips = useMemo(
    () => new Set([...disagreementHips, ...focusedSharedHips, ...heldSharedHips]),
    [disagreementHips, focusedSharedHips, heldSharedHips],
  );

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
      setSkyReady(true);
    }

    loadData().catch((error) => {
      console.error("Unable to load sky data", error);
    });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    for (const imageSrc of cultures.flatMap((culture) =>
      culture.constellations.flatMap((constellation) => (constellation.image ? [constellation.image.src] : [])),
    )) {
      if (illustrationCacheRef.current.has(imageSrc)) {
        continue;
      }

      const image = new Image();
      image.src = imageSrc;
      illustrationCacheRef.current.set(imageSrc, image);
    }
  }, [cultures]);

  useEffect(() => {
    return () => {
      if (heldSharedTimeoutRef.current !== null) {
        window.clearTimeout(heldSharedTimeoutRef.current);
      }
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
      let best: { constellation: Constellation; distance: number; centroid: { x: number; y: number } | null } | null =
        null;

      for (const constellation of culture.constellations) {
        const centroid = constellationCentroid(constellation, starsByHip, viewRef.current, width, height);

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

            if (distance < 20 && (!best || distance < best.distance)) {
              best = { constellation, distance, centroid };
            }
          }
        }
      }

      if (!best) {
        return null;
      }

      return {
        id: best.constellation.id,
        name: best.constellation.name,
        nativeName: best.constellation.nativeName,
        x: best.centroid?.x ?? x,
        y: best.centroid?.y ?? y,
      };
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
    let lastFrame = 0;
    let lastReadout = 0;
    let projectCurrent = (star: Star) => projectStar(star, viewRef.current, width, height);

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
      const hasFocus = Boolean(selectedConstellationId || hoveredConstellationId);
      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.setLineDash(options.ghost ? [7, 10] : []);

      for (const constellation of culture.constellations) {
        const hovered = constellation.id === hoveredConstellationId;
        const selected = constellation.id === selectedConstellationId;
        const awake = hovered || selected;
        const dimmed = hasFocus && !awake && !options.ghost;
        const strokeAlpha = options.alpha * (dimmed ? 0.12 : selected ? 1 : hovered ? 1 : options.ghost ? 0.56 : 0.72);
        const projectedLines = constellation.lines.map((line) =>
          line
            .map((hip) => starsByHip.get(hip))
            .filter((star): star is Star => Boolean(star))
            .map((star) => projectCurrent(star)),
        );

        if (awake && !options.ghost) {
          context.save();
          context.setLineDash([]);
          context.shadowColor = rgba(culture.accent, 0.92);
          context.shadowBlur = selected ? 30 : 22;
          context.strokeStyle = rgba(culture.accent, selected ? 0.34 : 0.28);
          context.lineWidth = selected ? 11 : 8;
          for (const points of projectedLines) {
            drawProgressPath(context, points, options.progress);
          }
          context.restore();
        }

        context.strokeStyle = rgba(lineColor, strokeAlpha);
        context.lineWidth = options.ghost ? 1.1 : selected ? 3.8 : hovered ? 3.2 : 1.6;
        context.shadowColor = rgba(lineColor, options.ghost ? 0.12 : awake ? 0.58 : 0.24);
        context.shadowBlur = options.ghost ? 0 : awake ? 11 : 5;

        for (const points of projectedLines) {
          drawProgressPath(context, points, options.progress);
        }

        if (awake && !options.ghost) {
          const highlightedHips = new Set(constellation.lines.flatMap((line) => line));
          for (const hip of highlightedHips) {
            const star = starsByHip.get(hip);
            if (!star) {
              continue;
            }

            const point = projectCurrent(star);
            if (!point.visible) {
              continue;
            }

            const pulse = reducedMotion ? 1 : 0.78 + Math.sin(performance.now() * 0.004 + star.phase) * 0.22;
            const radius = selected ? 10.5 : 7.5;
            context.save();
            context.strokeStyle = rgba(culture.accent, 0.48 * pulse);
            context.lineWidth = 1;
            context.beginPath();
            context.arc(point.x, point.y, radius + pulse * 3, 0, Math.PI * 2);
            context.stroke();
            context.fillStyle = rgba(culture.accent, selected ? 0.34 : 0.24);
            context.beginPath();
            context.arc(point.x, point.y, selected ? 3 : 2.4, 0, Math.PI * 2);
            context.fill();
            context.restore();
          }
        }
      }

      context.restore();
    };

    const drawIllustrationGhost = (constellation: Constellation | null, culture: Culture | undefined) => {
      if (!constellation?.image || !culture) {
        return;
      }

      const image = illustrationCacheRef.current.get(constellation.image.src);
      if (!image?.complete || image.naturalWidth === 0) {
        return;
      }

      let maskedImage = maskedIllustrationCacheRef.current.get(constellation.image.src);
      if (!maskedImage) {
        maskedImage = document.createElement("canvas");
        maskedImage.width = constellation.image.size[0];
        maskedImage.height = constellation.image.size[1];
        const maskedContext = maskedImage.getContext("2d");

        if (!maskedContext) {
          return;
        }

        maskedContext.drawImage(image, 0, 0, maskedImage.width, maskedImage.height);
        const centerX = maskedImage.width / 2;
        const centerY = maskedImage.height / 2;
        const radius = Math.max(maskedImage.width, maskedImage.height) * 0.58;
        const mask = maskedContext.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        mask.addColorStop(0, "rgba(0, 0, 0, 1)");
        mask.addColorStop(0.68, "rgba(0, 0, 0, 1)");
        mask.addColorStop(1, "rgba(0, 0, 0, 0)");
        maskedContext.globalCompositeOperation = "destination-in";
        maskedContext.fillStyle = mask;
        maskedContext.fillRect(0, 0, maskedImage.width, maskedImage.height);
        maskedIllustrationCacheRef.current.set(constellation.image.src, maskedImage);
      }

      const source = constellation.image.anchors.slice(0, 3).map((anchor) => ({
        x: anchor.imgX,
        y: anchor.imgY,
      }));
      const target = constellation.image.anchors.slice(0, 3).map((anchor) => {
        const star = starsByHip.get(anchor.hip);
        return star ? projectCurrent(star) : null;
      });

      if (target.some((point) => !point?.visible)) {
        return;
      }

      const projectedAnchors = target.map((point) => ({ x: point?.x ?? 0, y: point?.y ?? 0 }));
      const sourceCenter = source.reduce(
        (center, point) => ({ x: center.x + point.x / source.length, y: center.y + point.y / source.length }),
        { x: 0, y: 0 },
      );
      const targetCenter = projectedAnchors.reduce(
        (center, point) => ({
          x: center.x + point.x / projectedAnchors.length,
          y: center.y + point.y / projectedAnchors.length,
        }),
        { x: 0, y: 0 },
      );
      let farthestPair: [number, number] = [0, 1];
      let farthestDistance = 0;

      for (let first = 0; first < source.length; first += 1) {
        for (let second = first + 1; second < source.length; second += 1) {
          const distance = Math.hypot(source[second].x - source[first].x, source[second].y - source[first].y);
          if (distance > farthestDistance) {
            farthestDistance = distance;
            farthestPair = [first, second];
          }
        }
      }

      const sourceStart = source[farthestPair[0]];
      const sourceEnd = source[farthestPair[1]];
      const targetStart = projectedAnchors[farthestPair[0]];
      const targetEnd = projectedAnchors[farthestPair[1]];
      const sourceAngle = Math.atan2(sourceEnd.y - sourceStart.y, sourceEnd.x - sourceStart.x);
      const targetAngle = Math.atan2(targetEnd.y - targetStart.y, targetEnd.x - targetStart.x);
      const sourceDistance = Math.max(1, Math.hypot(sourceEnd.x - sourceStart.x, sourceEnd.y - sourceStart.y));
      const targetDistance = Math.hypot(targetEnd.x - targetStart.x, targetEnd.y - targetStart.y);
      const scale = clamp((targetDistance / sourceDistance) * 1.08, 0.16, 0.52);
      const clipRadius = clamp(
        Math.max(...projectedAnchors.map((point) => Math.hypot(point.x - targetCenter.x, point.y - targetCenter.y))) +
          82,
        128,
        280,
      );

      context.save();
      context.beginPath();
      context.ellipse(targetCenter.x, targetCenter.y, clipRadius * 1.05, clipRadius * 0.9, 0, 0, Math.PI * 2);
      context.clip();
      const selected = constellation.id === selectedConstellationId;
      const hoverLift = selected ? 0.08 : constellation.id === hoveredConstellationId ? 0.04 : 0;
      context.globalAlpha = reducedMotion ? 0.24 + hoverLift : 0.2 + hoverLift + Math.sin(performance.now() * 0.002) * 0.02;
      context.globalCompositeOperation = "screen";
      context.filter = `grayscale(1) contrast(1.62) brightness(${selected ? 1.38 : 1.28}) sepia(0.22) drop-shadow(0 0 ${
        selected ? 14 : 9
      }px ${culture.line})`;
      context.translate(targetCenter.x, targetCenter.y);
      context.rotate(targetAngle - sourceAngle);
      context.scale(scale, scale);
      context.drawImage(
        maskedImage,
        -sourceCenter.x,
        -sourceCenter.y,
        constellation.image.size[0],
        constellation.image.size[1],
      );
      context.restore();
    };

    const drawDisagreementPulse = (time: number) => {
      const pulseHips = new Set([
        ...activePulseHips,
        ...(transitionRef.current?.sharedHips ?? []),
      ]);

      if (pulseHips.size === 0) {
        return;
      }

      const pulse = reducedMotion ? 0.55 : 0.42 + Math.sin(time * 0.0022) * 0.17;
      context.save();
      context.globalCompositeOperation = "lighter";
      context.strokeStyle = rgba(activeCulture?.accent ?? "#E8D9A0", pulse);
      context.lineWidth = 1;

      for (const hip of pulseHips) {
        const star = starsByHip.get(hip);
        if (!star) {
          continue;
        }

        const point = projectCurrent(star);
        if (!point.visible || point.x < -12 || point.x > width + 12 || point.y < -12 || point.y > height + 12) {
          continue;
        }

        context.beginPath();
        context.arc(point.x, point.y, 6 + pulse * 10, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = rgba(activeCulture?.accent ?? "#E8D9A0", pulse * 0.18);
        context.beginPath();
        context.arc(point.x, point.y, 2.8, 0, Math.PI * 2);
        context.fill();
      }

      context.restore();
    };

    const render = (time: number) => {
      if (time - lastFrame < 1000 / 45) {
        animationFrame = requestAnimationFrame(render);
        return;
      }
      lastFrame = time;

      if (skyReady && ignitionStartedAtRef.current === null) {
        ignitionStartedAtRef.current = time;
      }

      const ignitionElapsed = ignitionStartedAtRef.current === null ? 0 : time - ignitionStartedAtRef.current;
      const skyIgnition = reducedMotion ? 1 : easeOutCubic(ignitionElapsed / 900);
      const lineIgnition = reducedMotion ? 1 : easeOutCubic((ignitionElapsed - 620) / 780);

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

      projectCurrent = createProjector(viewRef.current, width, height);
      const pointer = pointerRef.current;
      const parallaxX = reducedMotion || !pointer.active ? 0 : pointer.x * 10;
      const parallaxY = reducedMotion || !pointer.active ? 0 : pointer.y * 7;
      const focusHips = selectedHips.size > 0 ? selectedHips : hoveredHips;
      const hasStarFocus = focusHips.size > 0;

      context.save();
      context.globalCompositeOperation = "lighter";
      for (const star of stars) {
        const point = projectCurrent(star);
        const depth = clamp((6.4 - star.mag) / 5.8, 0.12, 1);
        const x = point.x + parallaxX * (0.25 + depth * 0.75);
        const y = point.y + parallaxY * (0.18 + depth * 0.64);

        if (!point.visible || x < -24 || x > width + 24 || y < -24 || y > height + 24) {
          continue;
        }

        const baseAlpha = Math.min(1, Math.max(0.25, (6.5 - star.mag) / 7));
        const twinkle = reducedMotion ? 1 : 0.97 + Math.sin(time * 0.001 + star.phase) * 0.035;
        const distanceFromCenter = Math.hypot(point.x - width / 2, point.y - height / 2) / Math.max(width, height);
        const starIgnition = reducedMotion
          ? 1
          : easeOutCubic((ignitionElapsed - distanceFromCenter * 420) / 900);
        const focused = focusHips.has(star.hip);
        const sharedPulse = activePulseHips.has(star.hip);
        const focusMultiplier = focused ? 1.72 : sharedPulse ? 1.42 : hasStarFocus || selectedConstellation ? 0.52 : 1;
        const alpha = clamp(baseAlpha * twinkle * skyIgnition * starIgnition * focusMultiplier, 0, 1);

        drawStar(context, x, y, star.mag, star.ci, alpha);
      }
      context.restore();

      const illustratedConstellation =
        selectedConstellation ??
        activeCulture?.constellations.find((constellation) => constellation.id === hoveredConstellationId) ??
        null;
      drawIllustrationGhost(illustratedConstellation, activeCulture);
      drawDisagreementPulse(time);

      if (pinnedCulture && pinnedCulture.id !== activeCulture?.id) {
        drawCulture(pinnedCulture, { alpha: 0.25, progress: 1, ghost: true });
      }

      if (activeCulture) {
        const transition = transitionRef.current;
        if (!transition || reducedMotion) {
          drawCulture(activeCulture, { alpha: lineIgnition, progress: lineIgnition });
        } else {
          const elapsed = time - transition.startedAt;
          const outgoing = cultures.find((culture) => culture.id === transition.from);
          const incoming = cultures.find((culture) => culture.id === transition.to);
          const growStart = SWITCH_RETRACT_MS + SWITCH_GAP_MS;
          const doneAt = growStart + SWITCH_GROW_MS;

          if (outgoing && elapsed < SWITCH_RETRACT_MS) {
            const outgoingProgress = 1 - easeOutCubic(elapsed / SWITCH_RETRACT_MS);
            drawCulture(outgoing, { alpha: 1, progress: outgoingProgress });
          }

          if (incoming && elapsed >= growStart) {
            const incomingProgress = easeOutCubic((elapsed - growStart) / SWITCH_GROW_MS);
            drawCulture(incoming, { alpha: 1, progress: incomingProgress });
          }

          if (elapsed > doneAt) {
            transitionRef.current = null;
          }
        }
      }

      if (time - lastReadout > 360) {
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
    activePulseHips,
    cultures,
    hoveredHips,
    hoveredConstellationId,
    pinnedCulture,
    reducedMotion,
    selectedConstellation,
    selectedConstellationId,
    selectedHips,
    skyReady,
    stars,
    starsByHip,
  ]);

  const setCulture = (cultureId: string) => {
    if (cultureId === activeCultureId) {
      return;
    }

    const fromCulture = cultures.find((culture) => culture.id === activeCultureId);
    const toCulture = cultures.find((culture) => culture.id === cultureId);
    const fromHips = cultureHipSet(fromCulture);
    const sharedHips = [...cultureHipSet(toCulture)].filter((hip) => fromHips.has(hip));
    const from = activeCulture?.label ?? activeCultureId;
    const to = toCulture?.label ?? cultureId;
    transitionRef.current = {
      from: activeCultureId,
      to: cultureId,
      startedAt: performance.now(),
      sharedHips,
    };
    setHasExplored(true);
    setSelectedConstellationId(null);
    setHoveredConstellationId(null);
    setHoverTarget(null);
    setFocusedSharedHips([]);
    setHeldSharedHips([]);
    setCultureSwitchNotice({ id: Date.now(), from, to });
    setActiveCultureId(cultureId);
  };

  const jumpToSharedFigure = (item: (typeof overlapInsights)[number]) => {
    const from = activeCulture?.label ?? activeCultureId;
    const to = item.culture;

    setHasExplored(true);
    setHoveredConstellationId(null);
    setHoverTarget(null);
    setFocusedSharedHips([]);
    setHeldSharedHips(item.sharedHips);

    if (heldSharedTimeoutRef.current !== null) {
      window.clearTimeout(heldSharedTimeoutRef.current);
    }

    heldSharedTimeoutRef.current = window.setTimeout(() => {
      setHeldSharedHips([]);
      heldSharedTimeoutRef.current = null;
    }, 2800);

    if (item.cultureId !== activeCultureId) {
      transitionRef.current = {
        from: activeCultureId,
        to: item.cultureId,
        startedAt: performance.now(),
        sharedHips: item.sharedHips,
      };
      setCultureSwitchNotice({ id: Date.now(), from, to });
      setActiveCultureId(item.cultureId);
    }

    setSelectedConstellationId(item.constellationId);
  };

  const resetView = () => {
    viewRef.current = { ...defaultView };
    setViewReadout(defaultView);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    setHasExplored(true);
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
      active: true,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      view: { ...viewRef.current },
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
      active: true,
    };

    if (dragRef.current) {
      const drag = dragRef.current;
      const effectiveZoom = viewportZoom(drag.view, rect.width, rect.height);
      const next = {
        ...drag.view,
        ra: wrapRa(drag.view.ra - ((event.clientX - drag.x) / effectiveZoom) * 4.2),
        dec: clamp(drag.view.dec + ((event.clientY - drag.y) / effectiveZoom) * 52, -72, 72),
      };
      viewRef.current = next;
      return;
    }

    const target = findConstellationAt(event.clientX - rect.left, event.clientY - rect.top, activeCulture);
    setHoveredConstellationId(target?.id ?? null);
    setHoverTarget(target);
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
      const target = findConstellationAt(event.clientX - rect.left, event.clientY - rect.top, activeCulture);
      setSelectedConstellationId(target?.id ?? null);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    setHasExplored(true);
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

  useEffect(() => {
    if (!cultureSwitchNotice) {
      return;
    }

    const timeout = window.setTimeout(() => setCultureSwitchNotice(null), 1180);
    return () => window.clearTimeout(timeout);
  }, [cultureSwitchNotice]);

  return (
    <main
      className={styles.shell}
      data-ready={skyReady}
      data-exploring={hasExplored || Boolean(selectedConstellation) || Boolean(pinnedCultureId)}
      data-hover={Boolean(hoverTarget)}
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
        onPointerLeave={() => {
          pointerRef.current = { x: 0, y: 0, active: false };
          setHoveredConstellationId(null);
          setHoverTarget(null);
        }}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />
      <div className={styles.loadingVeil} aria-hidden="true">
        <span>Aligning star catalog</span>
      </div>
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
            onClick={() => {
              setHasExplored(true);
              setPinnedCultureId(pinnedCultureId ? null : activeCultureId);
            }}
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

      {cultureSwitchNotice ? (
        <div key={cultureSwitchNotice.id} className={styles.switchNotice} aria-live="polite">
          <span>{cultureSwitchNotice.from}</span>
          <strong>{cultureSwitchNotice.to}</strong>
        </div>
      ) : null}

      {hoverTarget && !selectedConstellation ? (
        <div
          className={styles.hoverCard}
          style={
            {
              "--hover-x": `${hoverTarget.x}px`,
              "--hover-y": `${hoverTarget.y}px`,
            } as React.CSSProperties
          }
        >
          <span>Figure under cursor</span>
          <strong>{hoverTarget.name}</strong>
          {hoverTarget.nativeName ? <em>{hoverTarget.nativeName}</em> : null}
        </div>
      ) : null}

      {pinnedCulture && activeCulture ? (
        <div className={styles.compareLegend}>
          <span data-kind="ghost">Pinned {pinnedCulture.label}</span>
          <span data-kind="active">Active {activeCulture.label}</span>
          {pinnedCulture.id === activeCulture.id ? <strong>Switch culture to compare</strong> : null}
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
            {overlapInsights.length > 0 ? (
              <div className={styles.overlapNote}>
                <strong>Same stars also appear as</strong>
                {overlapInsights.map((item) => (
                  <button
                    key={`${item.culture}-${item.name}`}
                    type="button"
                    onClick={() => jumpToSharedFigure(item)}
                    onFocus={() => setFocusedSharedHips(item.sharedHips)}
                    onMouseEnter={() => setFocusedSharedHips(item.sharedHips)}
                    onBlur={() => setFocusedSharedHips([])}
                    onMouseLeave={() => setFocusedSharedHips([])}
                  >
                    {item.name} in {item.culture} ({item.count} shared stars)
                  </button>
                ))}
              </div>
            ) : null}
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
