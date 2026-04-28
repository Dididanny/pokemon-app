const express = require("express");
// usar fetch nativo de Node (Node 18+)

const app = express();

app.get("/price", async (req, res) => {
  console.log("/price hit", req.query);

  // DEBUG: respuesta inmediata para comprobar servidor
  if (req.query.debug === "1") {
    return res.json({ price: 123 });
  }

  const { name, setCode, number, setUrl } = req.query;

  if (!name) return res.json({ price: null });

  try {
    // búsqueda más precisa: nombre + set + número
    let queryParts = [`name:${name}`];

    // fix específico para cartas problemáticas como Ancient Mew
    if (name.toLowerCase().includes("ancient mew")) {
      queryParts = [`set.id:basep`, `number:PR11`];
    }

    if (setCode) queryParts.push(`set.id:${setCode.toLowerCase()}`);
    if (number) queryParts.push(`number:${number}`);
    const apiUrl = `https://api.pokemontcg.io/v2/cards?q=${queryParts.join(" ")}`;

    console.log("Fetching API:", apiUrl);

    const fetchPromise = fetch(apiUrl);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("API Timeout")), 3000)
    );

    let response;
    try {
      response = await Promise.race([fetchPromise, timeoutPromise]);
    } catch (e) {
      console.log("Timeout API");
      return res.json({ price: null });
    }

    const data = await response.json();

    if (!data || !data.data || data.data.length === 0) {
      console.log("No cards found in API");
      return res.json({ price: null });
    }

    // intentar encontrar coincidencia exacta
    let card = data.data.find(c => {
      const matchName = c.name.toLowerCase() === name.toLowerCase();
      const matchNumber = number ? c.number == number : true;
      return matchName && matchNumber;
    }) || data.data[0];

    if (!card.tcgplayer || !card.tcgplayer.prices) {
      console.log("No price data in API");
      return res.json({ price: null });
    }

    // intentar coger precio normal
    const priceObj = card.tcgplayer.prices.normal || card.tcgplayer.prices.holofoil || card.tcgplayer.prices.reverseHolofoil;

    if (!priceObj || !priceObj.low) {
      console.log("No valid price found");
      return res.json({ price: null });
    }

    const lowest = priceObj.low;
    console.log("Precio API:", lowest);

    return res.json({ price: lowest });

  } catch (err) {
    console.error("ERROR FETCH:", err.message);
    return res.json({ price: null });
  }
});

app.listen(3001, () => {
  console.log("🔥 Server running on http://localhost:3001");
});