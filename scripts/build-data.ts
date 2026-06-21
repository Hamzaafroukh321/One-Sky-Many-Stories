import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type RawConstellation = {
  id: string;
  lines?: number[][];
  image?: {
    file: string;
    size: [number, number];
    anchors: Array<{
      pos: [number, number];
      hip: number;
    }>;
  };
  common_name?: {
    english?: string;
    native?: string;
    pronounce?: string;
  };
};

type CultureIndex = {
  constellations: RawConstellation[];
};

type StoryNote = {
  id: string;
  myth: string;
};

type CultureSpec = {
  id: string;
  sourceFolder: string;
  label: string;
  region: string;
  accent: string;
  line: string;
  license: string;
  source: string;
  storyNotes: StoryNote[];
};

const ROOT = process.cwd();
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");
const CULTURES_DIR = path.join(PUBLIC_DATA_DIR, "cultures");

const HYG_URL =
  "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv";
const STELLARIUM_BASE =
  "https://raw.githubusercontent.com/Stellarium/stellarium-skycultures/master";

const cultures: CultureSpec[] = [
  {
    id: "greek",
    sourceFolder: "western",
    label: "Greek",
    region: "Europe",
    accent: "#E8D9A0",
    line: "#C9B66E",
    license: "Creative Commons; see Stellarium western sky culture license",
    source: "Stellarium Sky Cultures / Western sky culture",
    storyNotes: [
      {
        id: "CON western Ori",
        myth:
          "Orion is the great hunter, a huge human figure drawn around the bright belt stars. In Greek tradition his pride and violence lead to his death, and the hunter is set in the sky with the scorpion that can still chase him below the horizon.",
      },
      {
        id: "CON western UMa",
        myth:
          "Ursa Major is the Great Bear. Greek tellings often connect it with Callisto, transformed into a bear and then lifted among the stars, where the bear circles the northern sky without setting for many northern observers.",
      },
      {
        id: "CON western Sco",
        myth:
          "Scorpius is the scorpion sent against Orion. Its curved body and red Antares make the figure feel alive, and its rising as Orion leaves the sky turns the myth into a seasonal chase.",
      },
      {
        id: "CON western Cyg",
        myth:
          "Cygnus is the Swan, stretched along the Milky Way. Classical stories attach the bird to divine disguise, grief, and transformation, making the bright cross of stars a figure of passage between worlds.",
      },
      {
        id: "CON western Cas",
        myth:
          "Cassiopeia is the seated queen whose boast about beauty brought danger to her kingdom. The compact W-shaped figure keeps her visible near the north celestial pole, turning vanity into a permanent warning.",
      },
    ],
  },
  {
    id: "chinese",
    sourceFolder: "chinese",
    label: "Chinese",
    region: "East Asia",
    accent: "#E4434B",
    line: "#D98C2B",
    license: "Creative Commons; see Stellarium Chinese sky culture license",
    source: "Stellarium Sky Cultures / Chinese sky culture",
    storyNotes: [
      {
        id: "CON chinese 003",
        myth:
          "Three Stars, or Shenxiu, uses the bright stars western viewers know as Orion's Belt and sword. In the Chinese sky it is one of the lunar mansions and belongs to a wider courtly and seasonal map rather than a lone hunter.",
      },
      {
        id: "CON chinese 039",
        myth:
          "The Northern Dipper, Beidou, is a celestial ladle and regulator of time. Its turning around the pole marked seasons, directions, and imperial order in traditional Chinese astronomy.",
      },
      {
        id: "CON chinese 026",
        myth:
          "Heart, Xinxiu, centers on the red star Antares and forms the heart of the Azure Dragon. The star was watched as a seasonal fire, a sign of summer heat and agricultural timing.",
      },
      {
        id: "CON chinese 024",
        myth:
          "Tail, Weixiu, is another mansion of the Azure Dragon. The same stars that other traditions may divide into a scorpion become part of a long eastern dragon crossing the sky.",
      },
      {
        id: "CON chinese 029",
        myth:
          "Wings, Yixiu, belongs to the southern bird pattern. Its figure shows how Chinese astronomy often organized stars into officials, walls, beasts, and mansions rather than isolated mythic characters.",
      },
    ],
  },
  {
    id: "polynesian",
    sourceFolder: "hawaiian_starlines",
    label: "Polynesian",
    region: "Pacific",
    accent: "#34C7C2",
    line: "#F0876A",
    license: "Creative Commons; see Stellarium Hawaiian starlines sky culture license",
    source: "Stellarium Sky Cultures / Hawaiian Starlines",
    storyNotes: [
      {
        id: "CON hawaiian_starlines MAN",
        myth:
          "Manaiakalani, the Chief's Fishline, connects bright stars into the great fishhook associated with Maui. It is a navigational and story-bearing line, turning the sky into a tool for voyaging.",
      },
      {
        id: "CON hawaiian_starlines IWI",
        myth:
          "Ka Iwikuamoo, the Backbone, is a long guiding structure across the sky. Hawaiian starlines emphasize orientation, genealogy, and ocean travel as much as pictured figures.",
      },
      {
        id: "CON hawaiian_starlines NAH",
        myth:
          "Na Hiku, the Seven, gathers the familiar seven bright stars of the northern dipper pattern. In this sky culture the group participates in navigation and naming rather than becoming a bear.",
      },
      {
        id: "CON hawaiian_starlines KHK",
        myth:
          "Ka Hei-Hei o Na Keiki, the Cat's Cradle, uses the Orion stars as a woven game-like figure. The same anchors that form a Greek hunter become a pattern of play and line-work.",
      },
      {
        id: "CON hawaiian_starlines NAV",
        myth:
          "Navigator's Triangle is a practical oceanic figure. It draws a compact triangle from bright stars and treats the sky as a living compass for movement across the Pacific.",
      },
    ],
  },
];

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function buildStars() {
  console.log("Downloading HYG star catalog...");
  const csv = await fetchText(HYG_URL);
  const lines = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  const index = Object.fromEntries(headers.map((header, cellIndex) => [header, cellIndex]));
  const stars: Array<[number, string, number, number, number, number]> = [];
  const hipSet = new Set<number>();

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const hip = Number(cells[index.hip]);
    const mag = Number(cells[index.mag]);

    if (!Number.isInteger(hip) || hip <= 0 || !Number.isFinite(mag) || mag > 6) {
      continue;
    }

    const star: [number, string, number, number, number, number] = [
      hip,
      cells[index.proper] ?? "",
      toNumber(cells[index.ra]),
      toNumber(cells[index.dec]),
      mag,
      toNumber(cells[index.ci]),
    ];

    stars.push(star);
    hipSet.add(hip);
  }

  stars.sort((first, second) => first[4] - second[4]);
  await writeFile(path.join(PUBLIC_DATA_DIR, "stars.json"), JSON.stringify(stars), "utf8");
  console.log(`Wrote ${stars.length} visible stars.`);

  return hipSet;
}

function cleanSegments(lines: number[][] | undefined, hipSet: Set<number>, label: string) {
  const cleaned: number[][] = [];
  let missing = 0;

  for (const segment of lines ?? []) {
    const filtered = segment.filter((hip) => {
      const exists = hipSet.has(hip);
      if (!exists) {
        missing += 1;
      }
      return exists;
    });

    if (filtered.length >= 2) {
      cleaned.push(filtered);
    }
  }

  if (missing > 0) {
    console.warn(`${label}: skipped ${missing} line point(s) missing from filtered stars.`);
  }

  return cleaned;
}

async function buildCulture(culture: CultureSpec, hipSet: Set<number>) {
  const url = `${STELLARIUM_BASE}/${culture.sourceFolder}/index.json`;
  const index = JSON.parse(await fetchText(url)) as CultureIndex;
  const byId = new Map(index.constellations.map((constellation) => [constellation.id, constellation]));
  const illustrationDir = path.join(CULTURES_DIR, culture.id, "illustrations");
  await mkdir(illustrationDir, { recursive: true });

  const constellations = await Promise.all(culture.storyNotes.map(async (story) => {
    const constellation = byId.get(story.id);
    if (!constellation) {
      console.warn(`${culture.id}: missing ${story.id}`);
      return null;
    }

    const lines = cleanSegments(
      constellation.lines,
      hipSet,
      `${culture.label} / ${constellation.common_name?.english ?? constellation.id}`,
    );

    if (lines.length === 0) {
      console.warn(`${culture.id}: ${story.id} has no drawable lines after validation.`);
      return null;
    }

    let image:
      | {
          src: string;
          size: [number, number];
          anchors: Array<{ imgX: number; imgY: number; hip: number }>;
        }
      | undefined;

    if (constellation.image?.file && constellation.image.anchors.length >= 3) {
      const fileName = path.basename(constellation.image.file);
      const imageUrl = `${STELLARIUM_BASE}/${culture.sourceFolder}/${constellation.image.file}`;
      const imagePath = path.join(illustrationDir, fileName);
      const usableAnchors = constellation.image.anchors
        .filter((anchor) => hipSet.has(anchor.hip))
        .slice(0, 3)
        .map((anchor) => ({
          imgX: anchor.pos[0],
          imgY: anchor.pos[1],
          hip: anchor.hip,
        }));

      if (usableAnchors.length >= 3) {
        await writeFile(imagePath, await fetchBytes(imageUrl));
        image = {
          src: `/data/cultures/${culture.id}/illustrations/${fileName}`,
          size: constellation.image.size,
          anchors: usableAnchors,
        };
      } else {
        console.warn(`${culture.label} / ${constellation.common_name?.english ?? constellation.id}: illustration skipped because fewer than 3 anchors are in the filtered star set.`);
      }
    }

    return {
      id: constellation.id,
      name: constellation.common_name?.english ?? constellation.id,
      nativeName: constellation.common_name?.native ?? "",
      romanization: constellation.common_name?.pronounce ?? "",
      lines,
      myth: story.myth,
      ...(image ? { image } : {}),
    };
  }));

  const drawableConstellations = constellations.filter((constellation) => constellation !== null);

  const payload = {
    id: culture.id,
    label: culture.label,
    region: culture.region,
    accent: culture.accent,
    line: culture.line,
    license: culture.license,
    source: culture.source,
    constellations: drawableConstellations,
  };

  await writeFile(
    path.join(CULTURES_DIR, `${culture.id}.json`),
    JSON.stringify(payload, null, 2),
    "utf8",
  );
  console.log(`Wrote ${culture.label}: ${drawableConstellations.length} constellations.`);
}

async function main() {
  await mkdir(CULTURES_DIR, { recursive: true });
  const hipSet = await buildStars();

  for (const culture of cultures) {
    await buildCulture(culture, hipSet);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
