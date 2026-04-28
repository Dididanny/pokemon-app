// import { specialCards } from "./specialCards";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc
} from "firebase/firestore";

import {
  LayoutDashboard,
  PlusCircle,
  Star,
  BarChart3,
  TrendingUp,
  LineChart
} from "lucide-react";

import "./App.css";

const getCardImage = (card, pokemon) => {
  const name =
    card?.name?.toLowerCase() || pokemon?.name?.toLowerCase() || "";

  if (name.includes("ancient mew")) {
    return "https://product-images.tcgplayer.com/fit-in/437x437/84991.jpg";
  }

  const image = card?.images?.large || card?.images?.small || pokemon?.image;

  // ❌ evitar reversos (card back)
  if (image && image.includes("back")) {
    return "https://product-images.tcgplayer.com/fit-in/437x437/84991.jpg";
  }

  return (
    image ||
    "https://via.placeholder.com/245x342?text=No+Image"
  );
};

function App() {
  const [pokemons, setPokemons] = useState([]);
  const [view, setView] = useState("collection");

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);

  const [selectedLanguage, setSelectedLanguage] = useState("EN");
  const [customBuyPrice, setCustomBuyPrice] = useState("");
  const [loading, setLoading] = useState(false);

  // 📦 LOAD DATA
  useEffect(() => {
    const fetchData = async () => {
      const querySnapshot = await getDocs(collection(db, "cards"));
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPokemons(data);
    };

    fetchData();
  }, []);

  // 💰 PRICE
  const getPrice = (card) => {
    return (
      card.tcgplayer?.prices?.holofoil?.market ||
      card.tcgplayer?.prices?.normal?.market ||
      card.tcgplayer?.prices?.reverseHolofoil?.market ||
      1
    );
  };

  // 🔍 SEARCH (ordenado por precio + sin límite práctico)
  const searchCards = async (query) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);

    const parts = query.trim().split(" ");

    let name = parts[0] || "";
    let number = "";
    let set = "";

    parts.forEach(p => {
      if (/^\d+/.test(p)) {
        number = p.split("/")[0];
      } else if (p.length > 2 && p !== name) {
        set += p + " ";
      }
    });

    set = set.trim();

    // 🔥 búsqueda por palabras (mucho más fiable)
    const words = query.trim().split(" ");
    let q = words.map(w => `name:${w}*`).join(" ");

    if (number) q += ` number:${number}`;
    if (set) q += ` set.name:*${set}*`;

    try {
      let allResults = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 5) {
        const res = await fetch(
          `https://api.pokemontcg.io/v2/cards?q=${q}&pageSize=250&page=${page}`
        );

        const data = await res.json();

        if (data.data && data.data.length > 0) {
          allResults = [...allResults, ...data.data];
          page++;
        } else {
          hasMore = false;
        }
      }

      // 🔥 override TOTAL para Ancient Mew (evita resultados basura como Ducklett)
      if (query.toLowerCase().includes("ancient mew")) {
        allResults = [{
          id: "ancient-mew-manual",
          name: "Ancient Mew",
          images: {
            small: "https://images.pokemontcg.io/basep/PR11.png",
            large: "https://product-images.tcgplayer.com/fit-in/437x437/84991.jpg"
          },
          set: { name: "Promo" },
          number: "PR11",
          tcgplayer: {
            prices: {
              holofoil: { market: 40 }
            }
          }
        }];
      }

      const sorted = allResults.sort((a, b) => getPrice(b) - getPrice(a));

      setResults(sorted);
      setLoading(false);

    } catch (err) {
      console.error("Error búsqueda:", err);
    }
  };

  // ⚡ AUTO SEARCH
  useEffect(() => {
    const delay = setTimeout(() => {
      searchCards(search);
    }, 400);

    return () => clearTimeout(delay);
  }, [search]);

  // ➕ ADD
  const addPokemon = async (card) => {
    const existing = pokemons.find(p => p.cardId === card.id);
    if (existing) return alert("Ya tienes esta carta");

    const price = getPrice(card);
    const buyPriceFinal =
      customBuyPrice !== "" && !isNaN(customBuyPrice)
        ? Number(customBuyPrice)
        : price;

    if (customBuyPrice === "") {
      return alert("Introduce precio de compra manual para continuar");
    }

    const confirmAdd = window.confirm(
      `🚨 DEBUG NUEVO 🚨\n\nAñadir: ${card.name}\nSet: ${card.set?.name} #${card.number}\n\nIdioma seleccionado: ${selectedLanguage}\nPrecio compra introducido: ${customBuyPrice || "(AUTO) " + price} €`
    );

    if (!confirmAdd) return;

    console.log("ADDING CARD:");
    console.log("Language:", selectedLanguage);
    console.log("BuyPrice input:", customBuyPrice);
    console.log("BuyPrice final:", buyPriceFinal);

    const newCard = {
      cardId: card.id,
      name: card.name,
      image: getCardImage(card, null),
      set: card.set?.name || "Unknown",
      setCode: card.set?.ptcgoCode || "",
      setUrl: card.set?.name
        ?.replace(/\s+/g, "-")
        .replace(/[^\w-]/g, ""),
      number: card.number || "—",
      buyPrice: buyPriceFinal,
      price,
      language: selectedLanguage,
      history: [
        {
          date: new Date().toISOString(),
          price
        }
      ]
    };

    const docRef = await addDoc(collection(db, "cards"), newCard);

    setPokemons(prev => [...prev, { ...newCard, id: docRef.id }]);

    // 🔥 animación + redirección
    setView("collection");
    setTimeout(() => {
      const el = document.getElementById(docRef.id);

      if (el) {
        // 🔥 scroll automático suave
        el.scrollIntoView({ behavior: "smooth", block: "center" });

        // 🔥 animación premium
        el.classList.add("card-added");

        setTimeout(() => {
          el.classList.remove("card-added");
        }, 1500);
      }
    }, 200);

    setSearch("");
    setResults([]);
    setSelectedLanguage("EN");
    setCustomBuyPrice("");
  };

  // 🔄 UPDATE PRICES (modo pro)
  const updatePrices = async () => {
    const updated = [];

    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

    for (let p of pokemons) {
      try {
        const res = await fetch(
          `${API_URL}/price?name=${encodeURIComponent(p.name)}&number=${p.number}&setCode=${p.setCode || ""}&setUrl=${p.setUrl || ""}`
        );
        const data = await res.json();

        updated.push({
          ...p,
          price: data.price || p.price
        });

        // pequeña pausa para no saturar (MUY IMPORTANTE)
        await new Promise(r => setTimeout(r, 1000));

      } catch (err) {
        console.error("Error actualizando:", err);
        updated.push(p);
      }
    }

    setPokemons(updated);
  };
  // ❌ DELETE
  const deletePokemon = async (id) => {
    if (!window.confirm("¿Eliminar esta carta?")) return;

    await deleteDoc(doc(db, "cards", id));
    setPokemons(prev => prev.filter(p => p.id !== id));
  };

  // 📈 PROFIT
  const getProfit = (pokemon) => {
    const buy =
      pokemon.buyPrice !== undefined && pokemon.buyPrice !== null
        ? Number(pokemon.buyPrice)
        : Number(pokemon.price);

    return Number((Number(pokemon.price) - buy).toFixed(2));
  };

  // 📊 STATS
  const totalValue = pokemons.reduce(
    (acc, p) => acc + Number(p.price),
    0
  );

  const totalCards = pokemons.length;

  const avgPrice =
    totalCards > 0
      ? (totalValue / totalCards).toFixed(2)
      : 0;

  // 🔥 tendencia simple (ahora representa beneficio total)
  const totalProfit = pokemons.reduce((acc, p) => acc + (Number(p.price) - Number(p.buyPrice ?? p.price)), 0);
  const trendValue = totalProfit;
  const isPositive = trendValue >= 0;

  // 📈 gráfico beneficio semanal/mensual
  const profitHistory = [
  40,
  55,
  72,
  95,
  110,
  132,
  148,
  172,
  198,
  243
];

  const maxValue = Math.max(...profitHistory);

  const chartPoints = profitHistory
    .map((value, index) => {
      const x = (index / (profitHistory.length - 1)) * 100;
      const y = 100 - (value / maxValue) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo">
          <div className="pokeball"></div>
          <h2>PokéCollection</h2>
        </div>

        <ul>
          <li
            className={view === "collection" ? "active" : ""}
            onClick={() => setView("collection")}
          >
            <LayoutDashboard size={18} /> Colección
          </li>

          <li
            className={view === "add" ? "active" : ""}
            onClick={() => setView("add")}
          >
            <PlusCircle size={18} /> Añadir carta
          </li>

          <li>
            <Star size={18} /> Top cartas
          </li>

          <li>
            <BarChart3 size={18} /> Estadísticas
          </li>

          <li>
            <TrendingUp size={18} /> Beneficios
          </li>
        </ul>
      </aside>

      {/* MAIN */}
      <main className="main">

        {view === "collection" && (
          <>
            {/* HEADER MEJORADO */}
            <div className="header">
              <div>
                <h1 style={{ fontSize: "28px", fontWeight: "700" }}>
                  Colección combinada
                </h1>
                <p style={{ color: "#6b7280", marginTop: "4px" }}>
                  Todas nuestras cartas en una sola colección
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="add-btn"
                  onClick={() => setView("add")}
                >
                  + Añadir carta
                </button>

                <button
                  className="add-btn"
                  onClick={updatePrices}
                >
                  🔄 Actualizar precios
                </button>
              </div>
            </div>

            {/* STATS */}
            <div className="stats">

              <div className="stat-card">
                <p>Valor total</p>
                <h2>{totalValue.toFixed(2)} €</h2>
                <div className={`trend ${isPositive ? "positive" : "negative"}`}>
                  {isPositive ? "↑" : "↓"} {trendValue.toFixed(2)} €
                </div>
              </div>

              <div className="stat-card">
                <p>Beneficio total</p>
                <h2 className="green">
                  {isPositive ? "+" : ""}{trendValue.toFixed(2)} €
                </h2>
                <div className={`trend ${isPositive ? "positive" : "negative"}`}>
                  {isPositive ? "↑" : "↓"} 8.45%
                </div>
              </div>

              <div className="stat-card">
                <p>Total cartas</p>
                <h2>{totalCards}</h2>
              </div>

              <div className="stat-card">
                <p>Valor medio</p>
                <h2>{avgPrice} €</h2>
                <div className={`trend ${isPositive ? "positive" : "negative"}`}>
                  {isPositive ? "↑" : "↓"} {(totalProfit / (totalCards || 1)).toFixed(2)} €
                </div>
              </div>

            </div>

            {/* TOP + BENEFICIO */}
<div
  style={{
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "20px",
    marginBottom: "30px"
  }}
>

  {/* TOP CARTAS */}
  <div
    style={{
      background: "white",
      borderRadius: "20px",
      padding: "24px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.05)"
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "24px"
      }}
    >
      <h3 style={{ fontSize: "22px", fontWeight: "700" }}>
        🏆 Top cartas de la semana
      </h3>

      <span
        style={{
          color: "#4f46e5",
          fontWeight: "600",
          cursor: "pointer"
        }}
      >
        Ver todas
      </span>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "18px"
      }}
    >
      {[...pokemons]
        .sort((a, b) => getProfit(b) - getProfit(a))
        .slice(0, 5)
        .map((pokemon, index) => {

          const profit = getProfit(pokemon);

          return (
            <div key={pokemon.id}>

              <img
                src={getCardImage(null, pokemon)}
                alt={pokemon.name}
                style={{
                  width: "100%",
                  borderRadius: "14px",
                  marginBottom: "12px"
                }}
              />

              <h4
                style={{
                  fontSize: "16px",
                  fontWeight: "700"
                }}
              >
                {pokemon.name}
              </h4>

              <p
                style={{
                  color: "#6b7280",
                  fontSize: "13px",
                  marginBottom: "8px"
                }}
              >
                {pokemon.set}
              </p>

              <p
                style={{
                  fontWeight: "700"
                }}
              >
                {pokemon.price.toFixed(2)} €
              </p>

              <p
                style={{
                  color: "#22c55e",
                  fontWeight: "600",
                  fontSize: "14px"
                }}
              >
                ↑ {profit.toFixed(2)} €
              </p>

            </div>
          );
        })}
    </div>
  </div>

  {/* BENEFICIO */}
  <div
    style={{
      background: "white",
      borderRadius: "20px",
      padding: "24px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.05)"
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "12px"
      }}
    >
      <LineChart size={18} color="#4f46e5" />

      <span style={{ fontWeight: "700" }}>
        Beneficio semanal
      </span>
    </div>

    <h2
      style={{
        fontSize: "44px",
        fontWeight: "800",
        color: "#22c55e",
        marginBottom: "20px"
      }}
    >
      +{trendValue.toFixed(2)} €
    </h2>

    <div style={{ height: "220px" }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%" }}
      >

        <defs>
          <linearGradient id="gradientSmall" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
        </defs>

        <polygon
          fill="url(#gradientSmall)"
          points={`0,100 ${chartPoints} 100,100`}
        />

        <polyline
          fill="none"
          stroke="#4f46e5"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={chartPoints}
        />

      </svg>
    </div>
  </div>

</div>
            {/* CARDS ORDENADAS */}
            <div className="cards">
              {[...pokemons]
                .sort((a, b) => Number(b.price) - Number(a.price))
                .map((pokemon) => {

                const profit = getProfit(pokemon);

                return (
                  <div id={pokemon.id} key={pokemon.id} className="card">

                    <button
                      className="delete-btn"
                      onClick={() => deletePokemon(pokemon.id)}
                    >
                      ✕
                    </button>

                    <img
                      src={getCardImage(null, pokemon)}
                      alt={pokemon.name}
                    />

                    <h3>{pokemon.name}</h3>

                    <p className="card-sub">
                      {pokemon.set} · #{pokemon.number} {
                        (pokemon.language || "EN") === "ES" ? "🇪🇸" :
                        (pokemon.language || "EN") === "JP" ? "🇯🇵" :
                        "🇬🇧"
                      }
                    </p>

                    <p className="price">
                      Mercado: {pokemon.price.toFixed(2)} €
                    </p>

                    <p style={{ fontSize: "12px", color: "#6b7280" }}>
                      Compra: {pokemon.buyPrice?.toFixed(2)} €
                    </p>

                    <p className={profit >= 0 ? "profit positive" : "profit negative"}>
                      {profit >= 0 ? "↑" : "↓"} {profit} €
                    </p>

                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ADD */}
        {view === "add" && (
          <>
            <h1>Añadir carta</h1>

            <div className="search-box">
              <input
                type="text"
                placeholder="🔍 Buscar carta"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="filters">
                <div className="filter">
                  <label>Idioma</label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                  >
                    <option value="EN">🇬🇧 Inglés</option>
                    <option value="ES">🇪🇸 Español</option>
                    <option value="JP">🇯🇵 Japonés</option>
                  </select>
                </div>

                <div className="filter price-filter">
                  <label>Precio compra</label>

                  <div className="price-input">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder=""
                      value={customBuyPrice}
                      onChange={(e) => setCustomBuyPrice(e.target.value.replace(',', '.'))}
                    />
                    {customBuyPrice !== "" && <span className="euro">€</span>}
                  </div>

                </div>
              </div>
            </div>

            {loading && (
              <p style={{ marginTop: "10px", color: "#6b7280" }}>
                🔍 Buscando cartas...
              </p>
            )}

            <div className="cards">
              {results.map(card => {
                const price = getPrice(card);

                return (
                  <div key={card.id} className="card search-card">

                    <img
                      src={getCardImage(card, null)}
                      alt={card.name}
                    />

                    <h3>{card.name}</h3>

                    <p className="card-sub">
                      {card.set?.name} · #{card.number}
                    </p>

                    <p className="price">
                      {price.toFixed(2)} €
                    </p>

                    <button
                      className="add-card-btn"
                      onClick={() => addPokemon(card)}
                    >
                      Añadir
                    </button>

                  </div>
                );
              })}
            </div>
          </>
        )}

      </main>
    </div>
  );
}

export default App;