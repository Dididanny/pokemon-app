const fs = require("fs");
const path = require("path");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) =>
    fetch(...args)
  );

async function fetchLanguage(lang) {
  try {
    console.log(`🌍 Descargando idioma: ${lang}`);

    const response = await fetch(
      `https://api.tcgdex.net/v2/${lang}/cards`
    );

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.log(`❌ Error con ${lang}`);
      return [];
    }

    console.log(`✅ ${lang}: ${data.length} cartas`);

    return data.map((card) => ({
      // algunos endpoints compactos no traen id único fiable
      id:
        card.id ||
        `${lang}-${card.name}-${card.number}-${card.set?.id || card.set || "unknown"}`,
      name: card.name,
      number: card.number,
      rarity: card.rarity || null,

      language: lang,
      source: "tcgdex",

      image: card.image || null,

      images: {
        small: card.image || null,
        large: card.image
          ? `${card.image}/high.webp`
          : null,
      },

      set: {
        id:
          card.set?.id ||
          card.set ||
          "",

        name:
          card.set?.name ||
          card.set?.id ||
          card.set ||
          "Unknown Set",
      },

      setName:
        card.set?.name ||
        card.set?.id ||
        card.set ||
        "Unknown Set",

      marketPrice: null,
      price: null,
      hasPrice: false,
    }));
  } catch (e) {
    console.log(`❌ Error ${lang}:`, e.message);
    return [];
  }
}

function dedupe(cards = []) {
  const map = new Map();

  for (const card of cards) {
    const normalize = (str = "") =>
      String(str)
        .toLowerCase()
        .trim();

    // clave MUCHO menos agresiva
    // mantener promos, idiomas y variantes
    const key = [
      normalize(card.id),
      normalize(card.language),
      normalize(card.setName),
      normalize(card.number),
      normalize(card.name),
    ].join("_");

    if (!map.has(key)) {
      map.set(key, card);
    }
  }

  console.log(`🧪 Keys únicas generadas: ${map.size}`);
  return Array.from(map.values());
}

async function run() {
  console.log("🚀 Importando TCGdex...");

  // idiomas válidos TCGdex
  const languages = ["en", "ja"];

  const results = await Promise.all(
    languages.map(async (lang) => {
      const cards = await fetchLanguage(lang);

      console.log(`📚 Procesando ${lang}...`);

      return cards.filter((card) => {
        // eliminar solo entradas realmente rotas
        if (!card?.name) return false;

        return true;
      });
    })
  );

  const merged = results.flat();

  console.log(`📦 Total descargadas: ${merged.length}`);

  const unique = dedupe(merged);

  console.log(`🧹 Sin duplicados: ${unique.length}`);

  const outputPath = path.join(
    __dirname,
    "data",
    "tcgdex.json"
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(unique, null, 2),
    "utf8"
  );

  console.log(`💾 Guardado en:`);
  console.log(outputPath);

  console.log("🔥 Importación completada");
}

run();