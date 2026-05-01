const fs = require("fs");
const path = require("path");

const OUTPUT_PATH = path.join(__dirname, "data", "cards.json");

async function fetchAllCards() {
  let allCards = [];
  let page = 1;
  let hasMore = true;

  console.log("🚀 Descargando todas las cartas Pokémon...");

  while (hasMore) {
    const url = `https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=250`;

    console.log(`📦 Página ${page}`);

    try {
      const response = await fetch(url);
      const data = await response.json();

      const cards = data.data || [];

      if (!cards.length) {
        hasMore = false;
        break;
      }

      const simplifiedCards = cards.map((card) => ({
        id: card.id,
        name: card.name,
        number: card.number,
        setCode: card.set?.ptcgoCode || "",
        setName: card.set?.name || "",
        rarity: card.rarity || "",
        image:
          card.images?.large ||
          card.images?.small ||
          "",
        marketPrice:
          card.tcgplayer?.prices?.normal?.market ||
          card.tcgplayer?.prices?.holofoil?.market ||
          card.tcgplayer?.prices?.reverseHolofoil?.market ||
          null,
      }));

      allCards.push(...simplifiedCards);

      console.log(
        `✅ ${simplifiedCards.length} cartas añadidas`
      );

      page++;

    } catch (err) {
  console.error("❌ Error:", err.message);

  console.log("⏳ Reintentando en 3 segundos...");

  await new Promise((resolve) =>
    setTimeout(resolve, 3000)
  );

  continue;
}
  }

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(allCards, null, 2)
  );

  console.log("🎉 Importación completada");
  console.log(`📁 Archivo guardado en: ${OUTPUT_PATH}`);
  console.log(`🃏 Total cartas: ${allCards.length}`);
}

fetchAllCards();