const cors = require("cors");
const express = require("express");
const fs = require("fs");
const path = require("path");
// usar fetch nativo de Node (Node 18+)

const app = express();

const cardsPath = path.join(__dirname, "data", "cards.json");
const tcgdexPath = path.join(__dirname, "data", "tcgdex.json");
const manualPricesPath = path.join(__dirname, "data", "manual-prices.json");

const pokemonTcgCards = JSON.parse(
  fs.readFileSync(cardsPath, "utf8")
);

let tcgdexCards = [];

try {
  console.log("🔍 Buscando TCGdex en:", tcgdexPath);

  if (fs.existsSync(tcgdexPath)) {
    const rawTcgdex = fs.readFileSync(tcgdexPath, "utf8");

    tcgdexCards = JSON.parse(rawTcgdex);

    console.log(
      `🇯🇵 TCGdex cargado correctamente: ${tcgdexCards.length} cartas`
    );
  } else {
    console.log("❌ tcgdex.json NO encontrado");
  }
} catch (e) {
  console.log("❌ Error loading tcgdex.json:", e.message);
}

const ALL_CARDS = dedupeCards([
  ...pokemonTcgCards,
  ...tcgdexCards,
]);

console.log(`🃏 Cartas PokémonTCG: ${pokemonTcgCards.length}`);
console.log(`🃏 Cartas TCGdex: ${tcgdexCards.length}`);
console.log(`🃏 Cartas totales fusionadas: ${ALL_CARDS.length}`);

function loadManualPrices() {
  try {
    if (!fs.existsSync(manualPricesPath)) {
      return {};
    }

    return JSON.parse(
      fs.readFileSync(manualPricesPath, "utf8")
    );
  } catch (e) {
    console.log("❌ Error loading manual prices:", e.message);
    return {};
  }
}

function getManualAveragePrice(cardKey) {
  const manualPrices = loadManualPrices();

  const entry = manualPrices[cardKey];

  if (!entry || !Array.isArray(entry.prices)) {
    return null;
  }

  const validPrices = entry.prices
    .map((p) => Number(p))
    .filter((p) => !isNaN(p) && p > 0);

  if (!validPrices.length) {
    return null;
  }

  const avg =
    validPrices.reduce((sum, p) => sum + p, 0) /
    validPrices.length;

  return Number(avg.toFixed(2));
}

function getCardPrice(card) {
  const possiblePrices = [
    card.marketPrice,
    card.price,
    card.cardmarket?.prices?.trendPrice,
    card.cardmarket?.prices?.averageSellPrice,
    card.cardmarket?.prices?.avg1,
    card.cardmarket?.prices?.lowPriceExPlus,
    card.tcgplayer?.prices?.holofoil?.market,
    card.tcgplayer?.prices?.reverseHolofoil?.market,
    card.tcgplayer?.prices?.normal?.market,
    card.tcgplayer?.prices?.firstEditionHolofoil?.market,
    card.tcgplayer?.prices?.unlimitedHolofoil?.market,
    card.tcgplayer?.prices?.unlimited?.market,
  ];

  const valid = possiblePrices.find(
    (p) => p !== null && p !== undefined && !isNaN(Number(p)) && Number(p) > 0
  );

  return valid ? Number(valid).toFixed(2) : null;
}

// evitar cartas duplicadas entre APIs

function dedupeCards(cards = []) {
  const map = new Map();

  for (const card of cards) {
    const normalize = (str = "") =>
      String(str)
        .toLowerCase()
        .trim();

    // dedupe MUCHO menos agresivo
    // mantener idiomas, promos y variantes
    const key = [
      normalize(card.id),
      normalize(card.language),
      normalize(card.set?.id || card.setName),
      normalize(card.number),
      normalize(card.name),
    ].join("_");

    if (!map.has(key)) {
      map.set(key, card);
      continue;
    }

    const existing = map.get(key);

    // priorizar cartas con precio
    const existingPrice = Number(getCardPrice(existing) || 0);
    const newPrice = Number(getCardPrice(card) || 0);

    if (newPrice > existingPrice) {
      map.set(key, card);
      continue;
    }

    // priorizar imágenes HD
    const existingImage =
      existing.images?.large ||
      existing.images?.small ||
      existing.image;

    const newImage =
      card.images?.large ||
      card.images?.small ||
      card.image;

    if (!existingImage && newImage) {
      map.set(key, card);
    }
  }

  return Array.from(map.values());
}

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  return res.json({ ok: true, backend: "running" });
});

app.get("/search-local", async (req, res) => {
  try {
    const query = (req.query.q || "").toLowerCase();

    if (!query) {
      return res.json([]);
    }

    const normalizedQuery = query
      .toLowerCase()
      .trim();

    const queryParts = normalizedQuery.split(" ");

    const possibleNumber = queryParts[queryParts.length - 1];

    const hasNumber = /[0-9]/.test(possibleNumber);

    const searchName = hasNumber
      ? queryParts.slice(0, -1).join(" ")
      : normalizedQuery;

    let results = ALL_CARDS
      .filter((card) => {
        const cardName = (card.name || "")
          .toLowerCase();

        const cardNumber = String(card.number || "")
          .toLowerCase();

        const setName = (
          card.set?.name ||
          card.setName ||
          card.series ||
          ""
        ).toLowerCase();

        // búsqueda especial para cargar cartas japonesas
        // cuando el frontend usa "pokemon" como query genérica
        const isGenericPokemonSearch =
          searchName === "pokemon" ||
          searchName === "pokémon";

        const matchesName =
          cardName.includes(searchName);

        const matchesSet =
          setName.includes(searchName);

        const normalizedSet = setName
          .replace(/[^a-z0-9 ]/g, "")
          .trim();

        const normalizedSearch = searchName
          .replace(/[^a-z0-9 ]/g, "")
          .trim();

        const matchesLooseSet =
          normalizedSet.includes(normalizedSearch);

        // si estamos buscando cartas japonesas genéricas
        // devolver TODAS las japonesas aunque el nombre
        // esté escrito en japonés
        if (isGenericPokemonSearch) {
          const rawLang = (
            card.language ||
            card.lang ||
            ""
          )
            .toString()
            .toLowerCase()
            .trim();

          const isJapanese =
            rawLang === "ja" ||
            rawLang === "jp" ||
            rawLang === "japanese";

          return isJapanese;
        }

        if (
          !matchesName &&
          !matchesSet &&
          !matchesLooseSet
        ) {
          return false;
        }

        if (!hasNumber) {
          return true;
        }

        return cardNumber.includes(possibleNumber);
      })
      .map((card) => {
        const detectedPrice = getCardPrice(card);

        const rawLang = (
          card.language ||
          card.lang ||
          ""
        )
          .toString()
          .toLowerCase()
          .trim();

        const isJapanese =
          rawLang === "ja" ||
          rawLang === "jp" ||
          rawLang === "japanese";

        const tcgdexSetId =
          card.set?.id ||
          card.setId ||
          "base1";

        const tcgdexLocalId =
          card.localId ||
          card.number ||
          "1";

        const japaneseImage =
          `https://assets.tcgdex.net/ja/${tcgdexSetId}/${tcgdexLocalId}/high.webp`;

        const englishImage =
          `https://assets.tcgdex.net/en/${tcgdexSetId}/${tcgdexLocalId}/high.webp`;

        return {
          ...card,

          image:
            card.images?.large ||
            card.images?.small ||
            card.image ||
            card.imageUrl ||
            card.img ||
            (isJapanese
              ? japaneseImage
              : englishImage),

          setName:
            card.set?.name ||
            card.setName ||
            card.series ||
            card.set?.id ||
            tcgdexSetId ||
            "Pokemon",

          marketPrice:
            detectedPrice !== null
              ? Number(detectedPrice)
              : null,

          price:
            detectedPrice !== null
              ? Number(detectedPrice)
              : null,

          hasPrice: detectedPrice !== null,

          language: isJapanese
            ? "jp"
            : (rawLang || "en"),

          displayName:
            !isJapanese
              ? card.name
              : (
                  card.name?.match(/[a-zA-Z]/)
                    ? card.name
                    : `${card.name} (${tcgdexLocalId})`
                ),
        };
      })
      .sort((a, b) => {
        if (a.hasPrice && !b.hasPrice) return -1;
        if (!a.hasPrice && b.hasPrice) return 1;
        return (b.marketPrice || 0) - (a.marketPrice || 0);
      })
      .slice(0, 50);

    // =============================
    // LOCAL DATABASE ONLY
    // =============================

    // todo ya viene fusionado en memoria
    results = dedupeCards(results);

    // IMPORTANTE:
    // NO hidratar precios Cardmarket aquí.
    // El buscador debe ser instantáneo.
    // Los precios reales se actualizarán
    // únicamente dentro de la colección.
    return res.json(results);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Error buscando cartas",
    });
  }
});

app.get("/price", async (req, res) => {
  console.log("/price hit", req.query);

  const { name, number, setUrl, setCode } = req.query;

  // Manual price override block
  const manualKey = [
    String(name || "")
      .toLowerCase()
      .trim(),

    String(number || "")
      .toLowerCase()
      .trim(),

    String(setUrl || setCode || "")
      .toLowerCase()
      .trim()
  ].join("_");

  const manualAverage = getManualAveragePrice(manualKey);

  if (manualAverage) {
    console.log("💰 USING MANUAL PRICE:", {
      key: manualKey,
      price: manualAverage
    });

    return res.json({
      success: true,
      source: "manual",
      price: manualAverage
    });
  }

  return res.json({
    success: false,
    source: "manual-only",
    price: null,
    reason: "No manual price configured"
  });
});


app.listen(3001, () => {
  console.log("🔥 Server running on http://localhost:3001");
});