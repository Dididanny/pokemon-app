// import { specialCards } from "./specialCards";
import React, { useState } from "react";
import { useEffect, useRef } from "react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";

import {
  LayoutDashboard,
  PlusCircle,
  Star,
  Heart,
  Trophy,
  LineChart
} from "lucide-react";


import "./App.css";

const getApiBaseUrl = () => {
  // prioridad ENV
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // localhost dev
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return "http://localhost:3001";
  }

  // fallback producción Render
  return "https://pokemon-app-backend.onrender.com";
};

const getCardImage = (card, pokemon) => {
  const source = card || pokemon || {};

  const name =
    typeof source?.name === "string"
      ? source.name.toLowerCase()
      : "";

  // carta especial
  if (name.includes("ancient mew")) {
    return "https://product-images.tcgplayer.com/fit-in/437x437/84991.jpg";
  }

  // PokemonTCG
  const pokemonTcgImageLarge = source?.images?.large;
  const pokemonTcgImageSmall = source?.images?.small;

  // 🔥 TCGdex soporta MUCHOS formatos distintos
  let tcgdexImage = null;

  if (typeof source?.image === "string") {
    const cleanImage = source.image.trim();

    const isDirectImage =
      cleanImage.endsWith(".png") ||
      cleanImage.endsWith(".jpg") ||
      cleanImage.endsWith(".jpeg") ||
      cleanImage.endsWith(".webp") ||
      cleanImage.startsWith("http://") ||
      cleanImage.startsWith("https://") ||
      cleanImage.startsWith("data:image/");

    if (isDirectImage) {
      tcgdexImage = cleanImage;
    } else {
      tcgdexImage = `${cleanImage}/high.webp`;
    }
  }

  // 🔥 formatos extra reales de TCGdex
  const tcgdexHigh = source?.image?.high;
  const tcgdexLow = source?.image?.low;
  const tcgdexHd = source?.images?.high;
  const tcgdexFull = source?.image?.full;
  const tcgdexPng = source?.image?.png;
  const tcgdexWebp = source?.image?.webp;

  // 🔥 algunas cartas japonesas usan localId/image URL directa
  const directImage =
    source?.assets?.image ||
    source?.assets?.high ||
    source?.assets?.low ||
    source?.picture ||
    source?.img ||
    source?.thumbnail ||
    source?.imageUrl ||
    source?.cover ||
    source?.cardImage ||
    source?.image?.url;

  const firebaseImage =
    source?.manualImageUrl ||
    source?.imageUrl ||
    source?.image ||
    source?.images?.large ||
    source?.images?.small;

  const image =
    pokemonTcgImageLarge ||
    pokemonTcgImageSmall ||
    tcgdexHigh ||
    tcgdexHd ||
    tcgdexFull ||
    tcgdexPng ||
    tcgdexWebp ||
    tcgdexLow ||
    tcgdexImage ||
    directImage ||
    firebaseImage;

  // 🔥 evitar reversos/placeholder/imágenes inválidas
  if (image && typeof image === "string") {
    const lower = image.toLowerCase();

    const isCardBack =
      lower.includes("cardback") ||
      lower.includes("card-back") ||
      lower.includes("pokemon-card-back") ||
      lower.includes("back.jpg") ||
      lower.includes("back.png") ||
      lower.includes("back.webp") ||
      lower.includes("backside") ||
      lower.includes("no-image");

    if (isCardBack) {
      return (
        pokemonTcgImageLarge ||
        pokemonTcgImageSmall ||
        firebaseImage ||
        "https://via.placeholder.com/245x342?text=No+Image"
      );
    }
  }

  return (
    image ||
    firebaseImage ||
    "https://images.pokemontcg.io/base1/4_hires.png" ||
    "https://via.placeholder.com/245x342?text=No+Image"
  );
};

const CardImage = ({ card, pokemon, alt, className, style }) => {
  const [imgSrc, setImgSrc] = useState(() =>
    getCardImage(card, pokemon)
  );

  useEffect(() => {
    setImgSrc(getCardImage(card, pokemon));
  }, [card, pokemon]);

  return (
    <img
      src={imgSrc}
      alt={alt || "Pokemon card"}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const tcgId = card?.id || pokemon?.id;

        const fallbackCandidates = [
          tcgId
            ? `https://images.pokemontcg.io/${tcgId}_hires.png`
            : null,
          tcgId
            ? `https://images.pokemontcg.io/${tcgId}.png`
            : null,
          "https://via.placeholder.com/245x342?text=No+Image"
        ].filter(Boolean);

        const currentIndex = fallbackCandidates.indexOf(imgSrc);
        const nextSrc =
          fallbackCandidates[currentIndex + 1] ||
          fallbackCandidates[fallbackCandidates.length - 1];

        if (imgSrc !== nextSrc) {
          setImgSrc(nextSrc);
        }

        e.currentTarget.onerror = null;
      }}
    />
  );
};

const getDisplayName = (card) => {
  if (!card) return "Unknown Pokémon";

  if (typeof card.name === "string" && card.name.trim()) {
    return card.name;
  }

  if (typeof card.localName === "string" && card.localName.trim()) {
    return card.localName;
  }

  if (typeof card.englishName === "string" && card.englishName.trim()) {
    return card.englishName;
  }

  if (typeof card.name?.ja === "string") {
    return card.name.ja;
  }

  if (typeof card.name?.en === "string") {
    return card.name.en;
  }

  return "Unknown Pokémon";
};

const getDisplaySet = (card) => {
  if (!card) return "Unknown Set";

  if (typeof card.set?.name === "string") {
    return card.set.name;
  }

  if (typeof card.setName === "string") {
    return card.setName;
  }

  if (typeof card.series === "string") {
    return card.series;
  }

  if (typeof card.set?.id === "string") {
    return card.set.id;
  }

  return "Unknown Set";
};

const getCardLanguage = (card) => {
  if (!card) return "EN";

  return (
    card.language ||
    card.lang ||
    card.languages?.[0] ||
    card.locale ||
    "EN"
  );
};

const getCardType = (card) => {
  if (!card) return "Trainer";

  if (Array.isArray(card.types) && card.types.length > 0) {
    return card.types[0];
  }

  if (typeof card.supertype === "string") {
    return card.supertype;
  }

  if (typeof card.category === "string") {
    return card.category;
  }

  return "Unknown";
};

const getCardmarketUrl = (card) => {
  const rawName =
    card?.englishName ||
    card?.name ||
    "Pokemon";

  const cleanName = String(rawName)
    .replace(/Unknown/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const cleanNumber = String(card?.number || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim();

  const query = encodeURIComponent(
    `${cleanName} ${cleanNumber}`.trim()
  );

  return `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${query}`;
};


const getLanguageFlag = (lang = "EN") => {
  const normalized = String(lang).toUpperCase();

  if (normalized === "JP" || normalized === "JA") {
    return "🇯🇵 JP";
  }

  if (normalized === "ES") {
    return "🇪🇸 ES";
  }

  return "🇬🇧 EN";
};

// Reusable StatsCard component
const StatsCard = ({
  title,
  value,
  subtitle,
  trend,
  trendPositive = true,
}) => {
  return (
    <div
      className="stat-card"
      style={{
        background: "white",
        borderRadius: "14px",
        padding: "12px 16px",
        border: "1px solid #f1f5f9",
        boxShadow: "0 2px 10px rgba(0,0,0,0.035)",
        minWidth: 0,
      }}
    >
      <p
        style={{
          fontSize: "13px",
          color: "#6b7280",
          fontWeight: "500",
          marginBottom: "10px",
        }}
      >
        {title}
      </p>

      <h2
        style={{
          fontSize: "20px",
          fontWeight: "800",
          marginBottom: "8px",
          color: "#111827",
        }}
      >
        {value}
      </h2>

      {trend ? (
        <div
          className={`trend ${trendPositive ? "positive" : "negative"}`}
          style={{
            fontSize: "13px",
            fontWeight: "600",
          }}
        >
          {trend}
        </div>
      ) : (
        <p
          style={{
            color: "#6b7280",
            fontSize: "13px",
            fontWeight: "500",
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};

const SidebarItem = ({
  active,
  onClick,
  icon,
  label,
}) => {
  return (
    <li
      className={active ? "active" : ""}
      onClick={onClick}
      style={
        active
          ? {
              color: "rgba(255,255,255,0.92)",
              background:
                "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)",
              borderRadius: "12px",
            }
          : {
              color: "rgba(255,255,255,0.82)",
            }
      }
    >
      {icon} {label}
    </li>
  );
};

function App() {
  const [pokemons, setPokemons] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [view, setView] = useState("home");
  const [wishlistLoaded, setWishlistLoaded] = useState(false);
  // Detailed card modal state
  const [selectedCard, setSelectedCard] = useState(null);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [imageUrl, setImageUrl] = useState("");
const [selectedImage, setSelectedImage] = useState(null);
const fileInputRef = useRef(null);

  // Image upload preview and detected Pokémon state
  const [previewImage, setPreviewImage] = useState(null);
  const [detectedPokemon, setDetectedPokemon] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      const base64Image = reader.result;

      console.log("NEW IMAGE:", base64Image);

      // actualizar previews
      setPreviewImage(base64Image);
      setSelectedImage(base64Image);
      localStorage.setItem("lastManualCardImage", base64Image);

      // actualizar carta manual
      setManualCard((prev) => ({
        ...prev,
        image: base64Image,
        imageUrl: base64Image,
        images: {
          large: base64Image,
          small: base64Image,
        },
      }));

      // forzar nueva referencia del objeto
      setSelectedAddCard({
        name: manualCard.name || "Custom Card",
        number: manualCard.number || "000",
        set: {
          name: manualCard.set || "Custom Set",
        },
        rarity: manualCard.rarity || "",
        image: base64Image,
        imageUrl: base64Image,
        images: {
          large: base64Image,
          small: base64Image,
        },
      });

      setDetectedPokemon({
        name: "Custom Card",
        number: "000",
      });
    };

    reader.readAsDataURL(file);
  };



  const [selectedLanguage, setSelectedLanguage] = useState("EN");
  const [customBuyPrice, setCustomBuyPrice] = useState("");
  const [marketPrice1, setMarketPrice1] = useState("");
  const [marketPrice2, setMarketPrice2] = useState("");
  const [marketPrice3, setMarketPrice3] = useState("");
  const [selectedAddCard, setSelectedAddCard] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualCard, setManualCard] = useState({
    name: "",
    set: "",
    number: "",
    image: "",
    rarity: "",
  });
  const [loading, setLoading] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);

  // LOAD wishlist from localStorage
  useEffect(() => {
    const savedWishlist = localStorage.getItem("wishlist");

    if (savedWishlist) {
      try {
        setWishlist(JSON.parse(savedWishlist));
      } catch (err) {
        console.error("Error loading wishlist:", err);
      }
    }

    setWishlistLoaded(true);

    const savedManualImage = localStorage.getItem("lastManualCardImage");

    if (savedManualImage) {
      setSelectedImage(savedManualImage);
    }
  }, []);

  // SAVE wishlist to localStorage
  useEffect(() => {
    if (!wishlistLoaded) return;

    localStorage.setItem(
      "wishlist",
      JSON.stringify(wishlist)
    );
  }, [wishlist, wishlistLoaded]);

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
  if (!card) return 0;

  // ✅ media automática de precios manuales
  if (Array.isArray(card.manualPrices)) {
    const validPrices = card.manualPrices
      .map((p) => Number(p))
      .filter((p) => !isNaN(p) && p > 0);

    if (validPrices.length > 0) {
      const avg =
        validPrices.reduce((acc, p) => acc + p, 0) /
        validPrices.length;

      console.log("🧪 MANUAL PRICES:", card.name, validPrices);
      console.log("🧪 AVERAGE PRICE:", avg);

      return Number(avg.toFixed(2));
    }
  }

  // ✅ fallback precio manual único
  if (
    card.manualPrice !== undefined &&
    card.manualPrice !== null
  ) {
    const parsedManual = Number(card.manualPrice);

    if (!isNaN(parsedManual) && parsedManual > 0) {
      return parsedManual;
    }
  }

  // ✅ fallback Firebase price
  if (
    card.price !== undefined &&
    card.price !== null
  ) {
    const parsedPrice = Number(card.price);

    if (!isNaN(parsedPrice) && parsedPrice > 0) {
      return parsedPrice;
    }
  }

  return 0;
};

  // 🔍 SEARCH LOCAL DATABASE (20k+ cartas instantáneo)
  const searchCards = async (query) => {
    const normalizedQuery = query.trim();
    setLoading(true);

    try {
      const API_URL = getApiBaseUrl();
      const finalQuery = normalizedQuery;
      const res = await fetch(
        `${API_URL}/search-local?q=${encodeURIComponent(finalQuery)}`
      );

      const data = await res.json();

      const formatted = (data || []).map((card) => {
        // precios totalmente manuales
        const marketPrice =
  typeof card.marketPrice === "number"
    ? card.marketPrice
    : null;
        return {
          ...card,
            localName:
              card?.englishName ||
              card?.name?.en ||
              card?.localName ||
              card?.name?.ja ||
              card?.name ||
              "Unknown Pokémon",

          englishName:
            card?.englishName ||
            card?.name?.en ||
            card?.localName ||
            card?.name?.ja ||
            card?.name ||
            "Unknown Pokémon",

          // normalizar SET desde backend
          set: {
  name:
    card?.set?.name ||
    card?.setName ||
    card?.series ||
    card?.set?.id ||
    "Unknown Set",

  ptcgoCode:
    card?.set?.ptcgoCode ||
    card?.setCode ||
    card?.set?.id ||
    ""
},

          images: {
            large:
              card?.images?.large ||
              card?.image ||
              null,
            small:
              card?.images?.small ||
              card?.image ||
              null
          },
          tcgplayer: {
            prices: {
              holofoil: {
                market: Number(marketPrice || 0)
              },
              normal: {
                market: Number(marketPrice || 0)
              },
              reverseHolofoil: {
                market: Number(marketPrice || 0)
              }
            }
          }
        };
      });

      // detectar si el usuario busca número concreto
      // ej: "charmander 168"
      const normalizedSearch = finalQuery.trim().toLowerCase();

      const queryParts = normalizedSearch.split(/\s+/);

      const possibleNumber = queryParts[queryParts.length - 1];

      const hasSpecificNumber = /^\d+[a-zA-Z]*$/i.test(possibleNumber);

      let filtered = formatted;

      // si busca número exacto → priorizar coincidencia exacta
      if (hasSpecificNumber) {
        const exactMatches = formatted.filter((card) => {
          return (
            String(card.number || "")
              .toLowerCase()
              .replace(/\s/g, "") ===
            possibleNumber.toLowerCase()
          );
        });

        // si encuentra exactas, usamos solo esas
        if (exactMatches.length > 0) {
          filtered = exactMatches;
        }
      }

      // ordenar inteligente PRO
      // prioridad:
      // 1) nombre exacto
      // 2) número exacto
      // 3) cartas con precio
      // 4) más caras arriba
      const deduplicated = filtered.filter((card, index, self) => {
        const key = `${card.name}-${card.number}-${card.set?.name}`;
        return (
          index ===
          self.findIndex(
            (c) =>
              `${c.name}-${c.number}-${c.set?.name}` === key
          )
        );
      });

      const sorted = deduplicated.sort((a, b) => {
        const priceA = getPrice(a);
        const priceB = getPrice(b);

        const exactNameA =
          a.name?.toLowerCase?.() === normalizedSearch;

        const exactNameB =
          b.name?.toLowerCase?.() === normalizedSearch;

        if (exactNameA && !exactNameB) return -1;
        if (exactNameB && !exactNameA) return 1;

        const startsA = a.name
          ?.toLowerCase?.()
          ?.startsWith(normalizedSearch);

        const startsB = b.name
          ?.toLowerCase?.()
          ?.startsWith(normalizedSearch);

        if (startsA && !startsB) return -1;
        if (startsB && !startsA) return 1;

        // primero las que sí tienen precio
        if (priceA === 0 && priceB > 0) return 1;
        if (priceB === 0 && priceA > 0) return -1;

        return priceB - priceA;
      });

      setResults(sorted);
    } catch (err) {
      console.error("Error búsqueda local:", err);
      setResults([]);
    }

    setLoading(false);
  };

  // ⚡ AUTO SEARCH
  useEffect(() => {
    const delay = setTimeout(() => {
      searchCards(search);
    }, 400);

    return () => clearTimeout(delay);
  }, [search]);
  // 🖼 IMAGE UPLOAD
const handleFileUpload = (e) => {
  const file = e.target.files?.[0];

  if (!file) return;

  // Remove any usage of URL.createObjectURL for uploaded card images
  // Optionally, you may want to use a similar base64 approach here if needed
  // For now, simply do nothing or implement as needed
};

// 🔗 IMAGE URL
const handleImageUrl = async () => {
  if (!imageUrl.trim()) return;

  try {
    setSelectedImage(imageUrl.trim());
  } catch (err) {
    console.error("Error cargando URL:", err);
    alert("No se pudo cargar la imagen");
  }
};

  // ➕ ADD
  const addPokemon = async (card) => {
    const existing = pokemons.find(p => p.cardId === card.id);
    if (existing) return alert("Ya tienes esta carta");

    // instant UI price from PokemonTCG
    const instantPrice = 0;
    const buyPriceFinal =
      customBuyPrice !== "" && !isNaN(customBuyPrice)
        ? Number(customBuyPrice)
        : instantPrice;

    if (customBuyPrice === "") {
  return alert("Introduce el precio de compra");
}

if (
  marketPrice1 === "" ||
  marketPrice2 === "" ||
  marketPrice3 === ""
) {
  return alert("Introduce los 3 precios más baratos de Cardmarket");
}



    const newCard = {
      cardId: card?.id || crypto.randomUUID(),
      name: getDisplayName(card),

      englishName:
        card?.englishName ||
        card?.name?.en ||
        getDisplayName(card),
      image:
        selectedImage ||
        manualCard.image ||
        card?.image ||
        card?.imageUrl ||
        card?.images?.large ||
        card?.images?.small ||
        getCardImage(card, null),
      set: card.set?.name || "Unknown",

      // 🔥 usar SIEMPRE el ID real del set
      // ejemplos: sv3pt5, base1, swsh12pt5
      setCode:
        card?.set?.id ||
        card?.set?.ptcgoCode ||
        card?.setCode ||
        "",

      // 🔥 slug real para backend/Cardmarket
      setUrl:
        card?.set?.id ||
        card?.setUrl ||
        card?.set?.name
          ?.replace(/\s+/g, "-")
          .replace(/[^\w-]/g, "") ||
        "",
      number: card.number || "—",
      buyPrice: buyPriceFinal,
      price: buyPriceFinal,
      manualPrice: buyPriceFinal,
      manualPrices: [
        Number(marketPrice1),
        Number(marketPrice2),
        Number(marketPrice3)
      ],
      language: selectedLanguage,
      rarity: card?.rarity || "Unknown",
      source: card?.source || "PokemonTCG",
      manualImageUrl:
        selectedImage ||
        manualCard.image ||
        (typeof card?.image === "string" ? card.image : "") ||
        "",
      // start historical tracking from REAL buy price
      history: []
    };

    console.log("CARD TO SAVE:", newCard);
    const docRef = await addDoc(collection(db, "cards"), newCard);

    setPokemons(prev => [...prev, { ...newCard, id: docRef.id }]);


    // 🔥 animación + redirección
    console.log("✅ Carta añadida correctamente a Firebase");
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
    setMarketPrice1("");
    setMarketPrice2("");
    setMarketPrice3("");
    setSelectedImage(null);
    setSelectedAddCard(null);
    setManualMode(false);
    setPreviewImage(null);
    setDetectedPokemon(null);
    setCustomBuyPrice("");

    setManualCard({
      name: "",
      set: "",
      number: "",
      rarity: "",
      image: ""
    });
  };

  // 🔄 UPDATE PRICES
  const updatePrices = async () => {
    try {
      setUpdatingPrices(true);

      const updatedCards = await Promise.all(
        pokemons.map(async (pokemon) => {
          const currentPrice = Number(getPrice(pokemon) || 0);

          const history = Array.isArray(pokemon.history)
            ? pokemon.history
            : [];

          const newHistoryEntry = {
            price: currentPrice,
            date: new Date().toISOString()
          };

          const updatedHistory = [
            ...history,
            newHistoryEntry
          ];

          await updateDoc(doc(db, "cards", pokemon.id), {
            history: updatedHistory,
            updatedAt: new Date().toISOString()
          });

          return {
            ...pokemon,
            history: updatedHistory,
            updatedAt: new Date().toISOString()
          };
        })
      );

      setPokemons(updatedCards);

      alert("Histórico de precios actualizado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error actualizando el histórico de precios");
    } finally {
      setUpdatingPrices(false);
    }
  };

  useEffect(() => {
    console.log("✅ Sistema manual de precios activo");
  }, []);
  // ❌ DELETE
  const deletePokemon = async (id) => {
    if (!window.confirm("¿Eliminar esta carta?")) return;

    await deleteDoc(doc(db, "cards", id));
    setPokemons(prev => prev.filter(p => p.id !== id));
  };

  // 📈 PROFIT
  const getProfit = (pokemon) => {
  const marketPrice = getPrice(pokemon);

  const buy =
    pokemon.buyPrice !== undefined && pokemon.buyPrice !== null
      ? Number(pokemon.buyPrice)
      : 0;

  return Number((marketPrice - buy).toFixed(2));

  };

  // 📊 STATS
const totalValue = pokemons.reduce(
  (acc, p) => acc + getPrice(p),
  0
);

const totalInvested = pokemons.reduce((acc, pokemon) => {
  const buyPrice =
    pokemon.buyPrice !== undefined && pokemon.buyPrice !== null
      ? Number(pokemon.buyPrice)
      : 0;

  return acc + buyPrice;
}, 0);

const currentProfit = Number(
  (totalValue - totalInvested).toFixed(2)
);

const totalCards = pokemons.length;

const avgPrice =
  totalCards > 0
    ? (totalValue / totalCards).toFixed(2)
    : 0;

  // 📈 HISTORIAL REAL ÚLTIMOS 7 DÍAS
  const today = new Date();

  const profitHistory = Array.from({ length: 7 }, (_, index) => {
    const currentDate = new Date();
    currentDate.setDate(today.getDate() - (6 - index));

    const startOfDay = new Date(currentDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(currentDate);
    endOfDay.setHours(23, 59, 59, 999);

    let totalDayValue = 0;

    pokemons.forEach((pokemon) => {
      const history = Array.isArray(pokemon.history)
        ? pokemon.history
        : [];

      // get latest historical entry UP TO this day
      const historicalEntry = history
        .filter((entry) => {
          const entryDate = new Date(entry.date);
          return entryDate <= endOfDay;
        })
        .sort(
          (a, b) =>
            new Date(b.date) - new Date(a.date)
        )[0];

      const buyPrice =
        pokemon.buyPrice !== undefined && pokemon.buyPrice !== null
          ? Number(pokemon.buyPrice)
          : 0;

      if (historicalEntry) {
        totalDayValue +=
          Number(historicalEntry.price || 0) - buyPrice;
      } else {
        totalDayValue += 0 - buyPrice;
      }
    });

    return {
      day: currentDate.toLocaleDateString("es-ES", {
        weekday: "short"
      }),
      value: totalDayValue
    };
  });

  const firstDayValue = profitHistory[0]?.value || 0;
  const lastDayValue =
    profitHistory[profitHistory.length - 1]?.value || 0;

  const weeklyProfitChange = Number(
    (lastDayValue - firstDayValue).toFixed(2)
  );

  const trendValue = currentProfit;
  const isPositive = currentProfit >= 0;

  const values = profitHistory.map((p) => p.value);

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  const normalizedPoints = profitHistory.map((point, index) => {
    const x = 10 + (index / (profitHistory.length - 1)) * 80;

    const y =
      72 -
      ((point.value - minValue) / (maxValue - minValue || 1)) * 48;

    return {
      ...point,
      x,
      y
    };
  });

  const chartPath = normalizedPoints
    .map((point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }

      const prev = normalizedPoints[index - 1];
      const cx = (prev.x + point.x) / 2;

      return `C ${cx} ${prev.y}, ${cx} ${point.y}, ${point.x} ${point.y}`;
    })
    .join(" ");

  const areaPath = `
    ${chartPath}
    L 100 84
    L 0 84
    Z
  `;

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside
        className="sidebar"
        style={{
          background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
          color: "white",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "inset -1px 0 0 rgba(255,255,255,0.04)"
        }}
      >
        <div className="mew-float">
  <img
    src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/151.png"
    alt="Mew"
  />
</div>

<div className="pikachu-float">
  <img
    src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png"
    alt="Pikachu"
  />
</div>
<div className="charizard-float">
  <img
    src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png"
    alt="Charizard"
  />
</div>
        
        <div
          className="logo"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "11px",
            width: "100%",
            paddingLeft: "36px",
            paddingRight: "40px",
            paddingTop: "20px",
            paddingBottom: "1px",
            boxSizing: "border-box"
          }}
        >
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              background:
                "linear-gradient(to bottom, #ef4444 0%, #ef4444 48%, #ffffff 48%, #ffffff 100%)",
              border: "1.5px solid #0f172a",
              position: "relative",
              boxShadow: "0 3px 8px rgba(0,0,0,0.22)"
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                width: "100%",
                height: "1px",
                background: "#0f172a",
                transform: "translateY(-50%)"
              }}
            />

            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "7px",
                height: "7px",
                background: "white",
                border: "2px solid #0f172a",
                borderRadius: "50%",
                transform: "translate(-50%, -50%)"
              }}
            />
          </div>

          <h2
            style={{
              color: "white",
              fontSize: "14px",
              fontWeight: "700",
              letterSpacing: "-0.4px",
              margin: 0,
              lineHeight: 1,
              transform: "translateY(-1px)"
            }}
          >
            PokéCollection
          </h2>
        </div>

        <ul style={{ marginTop: "14px" }}>
          <SidebarItem
            active={view === "home"}
            onClick={() => setView("home")}
            icon={<LayoutDashboard size={18} />}
            label="Inicio"
          />

          <SidebarItem
            active={view === "collection"}
            onClick={() => setView("collection")}
            icon={<Star size={18} />}
            label="Colección"
          />

          <SidebarItem
            active={view === "wishlist"}
            onClick={() => setView("wishlist")}
            icon={<Heart size={18} />}
            label="Wishlist"
          />

          <SidebarItem
            active={view === "add"}
            onClick={() => setView("add")}
            icon={<PlusCircle size={18} />}
            label="Añadir carta"
          />

          <SidebarItem
            active={view === "top"}
            onClick={() => setView("top")}
            icon={<Trophy size={18} />}
            label="Top cartas"
          />
        </ul>
      </aside>

      {/* MAIN */}
      <main
        className="main"
        style={{
          padding: "8px 10px 8px 8px",
          width: "100%",
          minWidth: 0,
          height: "100vh",
          overflowX: "hidden",
          minHeight: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          background: "#f5f7fb"
        }}
      >
        {view === "home" && (
          <>
            {/* HEADER MEJORADO */}
            <div className="header">
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: "700", lineHeight: 1.1 }}>
                  Dashboard colección
                </h1>
                <p style={{ color: "#6b7280", marginTop: "2px", fontSize: "14px" }}>
                  Todas nuestras cartas en una sola colección
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="add-btn"
                  onClick={() => setView("add")}
                  style={{
                    padding: "10px 16px",
                    fontSize: "14px",
                    borderRadius: "12px",
                    fontWeight: "600"
                  }}
                >
                  + Añadir carta
                </button>

                <button
                  className="add-btn"
                  onClick={updatePrices}
                  style={{
                    padding: "10px 16px",
                    fontSize: "14px",
                    borderRadius: "12px",
                    fontWeight: "600",
                    opacity: updatingPrices ? 0.7 : 1,
                    cursor: updatingPrices ? "wait" : "pointer"
                  }}
                >
                  {updatingPrices ? "⏳ Actualizando..." : "🔄 Actualizar precios"}
                </button>
              </div>
            </div>

            {/* STATS */}
            <div
              className="stats"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "14px",
                marginBottom: "14px"
              }}
            >

              <StatsCard
                title="Valor total de la colección"
                value={`${totalValue.toFixed(2)} €`}
                trend="↑ 8.45% esta semana"
                trendPositive={isPositive}
              />

              <StatsCard
                title="Dinero invertido"
                value={`${totalInvested.toFixed(2)} €`}
                trend="Total gastado en cartas"
                trendPositive={true}
              />

              <StatsCard
                title="Beneficio / Pérdida actual"
                value={`${isPositive ? "+" : ""}${currentProfit.toFixed(2)} €`}
                subtitle={`Cambio semanal: ${weeklyProfitChange >= 0 ? "+" : ""}${weeklyProfitChange.toFixed(2)} €`}
              />

              <StatsCard
                title="Total de cartas"
                value={totalCards}
                subtitle="Todas las expansiones"
              />

            </div>

            {/* TOP + BENEFICIO */}
            <div
  style={{
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(340px, 0.9fr)",
    gap: "14px",
    marginBottom: "14px",
    alignItems: "stretch",
    height: "calc(100vh - 320px)",
    minHeight: 0
  }}
>

  {/* TOP CARTAS */}
  <div
    style={{
      background: "white",
      borderRadius: "14px",
      padding: "16px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.035)",
      border: "1px solid #f1f5f9",
      height: "100%",
      overflow: "hidden"
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "16px"
      }}
    >
      <h3
  style={{
    fontSize: "15px",
    fontWeight: "700"
  }}
>
        🏆 Top cartas de la semana
      </h3>

      <span
        onClick={() => setView("top")}
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
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "8px",
        alignItems: "start",
        height: "100%"
      }}
    >
      {[...pokemons]
        .sort((a, b) => getProfit(b) - getProfit(a))
        .slice(0, 5)
        .map((pokemon, index) => {

          const profit = getProfit(pokemon);

          return (
            <div
              key={pokemon.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                width: "100%",
                transform: "scale(1)",
                justifyContent: "flex-start"
              }}
            >

              <CardImage
                pokemon={pokemon}
                alt={pokemon.name}
                className={undefined}
                style={{
                  width: "100%",
                  borderRadius: "10px",
                  marginBottom: "6px",
                  maxHeight: "190px",
                  objectFit: "contain"
                }}
              />

              <h4
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  marginBottom: "3px",
                  lineHeight: 1.15,
                  textAlign: "center"
                }}
              >
                {pokemon.name}
              </h4>

              <p
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  marginBottom: "2px",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  width: "100%",
                  lineHeight: 1.1
                }}
              >
                {pokemon.set}
              </p>

              <p
                style={{
                  fontWeight: "700",
                  fontSize: "13px"
                }}
              >
              
              </p>

              <p
                style={{
                  color: "#22c55e",
                  fontWeight: "600",
                  fontSize: "12px"
                }}
              >
                ↑ {profit.toFixed(2)} €
              </p>
              <a
                href={getCardmarketUrl(pokemon)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginTop: "10px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  padding: "9px 10px",
                  borderRadius: "10px",
                  minHeight: "38px",
                  boxSizing: "border-box",
                  background: "#2563eb",
                  color: "white",
                  textDecoration: "none",
                  fontSize: "11px",
                  fontWeight: "700"
                }}
              >
                Cardmarket
              </a>

            </div>
          );
        })}
    </div>
  </div>

  {/* BENEFICIO */}
  <div
    style={{
      background: "white",
      borderRadius: "14px",
      padding: "12px 16px 6px 16px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.035)",
      border: "1px solid #f1f5f9",
      height: "100%",
      width: "100%",
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      overflow: "hidden"
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "8px"
      }}
    >
      <LineChart size={18} color="#4f46e5" />

      <span
  style={{
    fontWeight: "700",
    fontSize: "15px"
  }}
>
        Beneficio semanal
      </span>
    </div>

    <h2
      style={{
        fontSize: "24px",
        fontWeight: "800",
        color: "#22c55e",
        marginBottom: "4px"
      }}
    >
      +{trendValue.toFixed(2)} €
    </h2>

    <div
      style={{
        height: "300px",
padding: "12px 6px 4px 0px",
borderRadius: "18px",
background:
  "linear-gradient(180deg, rgba(99,102,241,0.06) 0%, rgba(255,255,255,0.9) 100%)",
overflow: "hidden"
      }}
    >
      <svg
        viewBox="-3 0 106 96"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >

        <defs>
          <linearGradient id="gradientArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>

          <filter id="softGlow">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* GRID */}
        {[20, 35, 50, 65, 80].map((line) => (
          <line
            key={line}
            x1="0"
            y1={line}
            x2="100"
            y2={line}
            stroke="#eef2ff"
            strokeWidth="0.8"
          />
        ))}

        {/* PRECIOS LATERALES */}
        {[
          { y: 20, value: "300 €" },
          { y: 35, value: "225 €" },
          { y: 50, value: "150 €" },
          { y: 65, value: "75 €" },
          { y: 80, value: "0 €" },
        ].map((label) => (
          <text
            key={label.value}
            x="2"
            y={label.y}
            textAnchor="start"
            fontSize="2.8"
            fill="#94a3b8"
            fontWeight="500"
          >
            {label.value}
          </text>
        ))}

        {/* DÍAS */}
        {normalizedPoints.map((point) => (
          <text
            key={point.day}
            x={point.x}
            y="91"
            textAnchor="middle"
            fontSize="3.4"
            fill="#64748b"
            fontWeight="700"
          >
            {point.day}
          </text>
        ))}

        {/* ÁREA */}
        <path
          d={areaPath}
          fill="url(#gradientArea)"
        />

        {/* LÍNEA */}
        <path
          d={chartPath}
          fill="none"
          stroke="#5b4ff7"
        strokeWidth="2.6"
strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#softGlow)"
        />

        {/* PUNTOS + TOOLTIP */}
        {normalizedPoints.map((point, index) => (
          <g key={index}>
            <circle
              cx={point.x}
              cy={point.y}
              r="1.8"
              fill="#ffffff"
              stroke="#5b4ff7"
              strokeWidth="1.2"
            >
              <title>{`${point.day} · +${point.value.toFixed(2)} €`}</title>
            </circle>
          </g>
        ))}

      </svg>
    </div>
  </div>

</div>
            {/* WISHLIST */}
            <div
              style={{
                background: "white",
                borderRadius: "14px",
                padding: "16px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.035)",
                border: "1px solid #f1f5f9",
                marginBottom: "14px",
                marginTop: "0px",
                height: "190px",
                overflow: "hidden",
                flexShrink: 0,
                boxSizing: "border-box"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "18px"
                }}
              >
                <h3
  style={{
    fontSize: "15px",
    fontWeight: "700"
  }}
>
                  ❤️ Wishlist
                </h3>

                <span
                  onClick={() => setView("wishlist")}
                  style={{
                    color: "#4f46e5",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  Ver wishlist
                </span>
              </div>

              <div
                style={{
                  textAlign: "center",
                  padding: wishlist.length === 0 ? "55px 20px" : undefined,
                  color: "#6b7280"
                }}
              >
                {wishlist.length === 0 ? (
  <div
    style={{
      textAlign: "center",
      padding: "55px 20px",
      color: "#6b7280"
    }}
  >
    No hay cartas en wishlist todavía.
  </div>
) : (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
      gap: "4px",
      alignItems: "start",
      width: "100%"
    }}
  >
    {wishlist.map((card, index) => (
      <div
        key={index}
        style={{
          width: "100%",
          minWidth: 0,
          transform: "scale(0.88)"
        }}
      >

        <CardImage
          card={card}
          alt={card.name}
          className={undefined}
          style={{
            width: "100%",
            borderRadius: "10px",
            marginBottom: "6px",
            maxHeight: "102px",
            objectFit: "contain"
          }}
        />

        <h4
          style={{
            fontSize: "12px",
            fontWeight: "700"
          }}
        >
          {card.name}
        </h4>

        <div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    marginTop: "2px"
  }}
>
  <p
    style={{
      color: "#6b7280",
      fontSize: "10px",
      fontWeight: "600"
    }}
  >
    🧩 {card.set || "Unknown Set"}
  </p>

  <p
    style={{
      color: "#64748b",
      fontSize: "9px",
      fontWeight: "600"
    }}
  >
    🌍 {(card.language || card.lang || "EN").toUpperCase()}
  </p>

  <p
    style={{
      color: "#4f46e5",
      fontSize: "9px",
      fontWeight: "700"
    }}
  >
    ✨ {card.supertype || card.category || card.cardType || "Pokémon"}
  </p>
</div>
        <p
  style={{
    fontWeight: "700",
    fontSize: "11px",
    marginTop: "4px"
  }}
>
  {getPrice(card).toFixed(2)} €
</p>
        <a
          href={getCardmarketUrl(card)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: "6px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            padding: "7px 8px",
            borderRadius: "8px",
            background: "#2563eb",
            color: "white",
            textDecoration: "none",
            fontSize: "10px",
            fontWeight: "700"
          }}
        >
          Cardmarket
        </a>

      </div>
    ))}
  </div>
)}
              </div>
            </div>
          </>
        )}
{view === "collection" && (
  <>
    <div className="header">
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "700" }}>
          📚 Mi colección
        </h1>

        <p style={{ color: "#6b7280", marginTop: "4px" }}>
          Todas tus cartas ordenadas por valor actual
        </p>
      </div>
    </div>

    <div
      className="cards"
      style={{
        marginTop: "24px",
        paddingBottom: "120px",
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(210px, 1fr))",
        gap: "18px",
        width: "100%",
        alignItems: "start",
        overflow: "visible"
      }}
    >
      {[...pokemons]
        .sort((a, b) => getPrice(b) - getPrice(a))
        .map((pokemon) => {
          const profit = getProfit(pokemon);
          return (
            <div
              id={pokemon.id}
              key={pokemon.id}
              className="card"
              style={{
                width: "100%",
                maxWidth: "220px",
                minWidth: 0,
                justifySelf: "center",
                cursor: "pointer",
                transition: "transform 0.15s cubic-bezier(.4,2,.6,1), box-shadow 0.15s",
              }}
              onClick={(e) => {
                // Only open modal when not clicking delete button
                if (e.target.closest(".delete-btn")) return;
                setSelectedCard(pokemon);
              }}
            >
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deletePokemon(pokemon.id);
                }}
              >
                ✕
              </button>
              <CardImage
                pokemon={pokemon}
                alt={pokemon.name}
                className={undefined}
              />
              <h3>{pokemon.name}</h3>
              <p className="card-sub">
                {pokemon.set} · #{pokemon.number}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  marginTop: "4px",
                  marginBottom: "10px"
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    padding: "4px 8px",
                    borderRadius: "999px",
                    background: "#eef2ff",
                    color: "#4338ca",
                    fontWeight: "700"
                  }}
                >
                  {getLanguageFlag(pokemon.language)}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    padding: "4px 8px",
                    borderRadius: "999px",
                    background: "#f1f5f9",
                    color: "#475569",
                    fontWeight: "700"
                  }}
                >
                  {pokemon.rarity || "Sin rareza"}
                </span>
              </div>
              
              <p style={{ fontSize: "12px", color: "#6b7280" }}>
                Compra: {pokemon.buyPrice?.toFixed(2)} €
              </p>
              <p className={profit >= 0 ? "profit positive" : "profit negative"}>
                {profit >= 0 ? "↑" : "↓"} {profit.toFixed(2)} €
              </p>
              <a
                href={getCardmarketUrl(pokemon)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginTop: "10px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  background: "#2563eb",
                  color: "white",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: "700",
                  transition: "0.2s"
                }}
                onClick={e => e.stopPropagation()}
              >
                Ver en Cardmarket
              </a>
            </div>
          );
        })}
    </div>
      {/* Detailed Card Modal */}
      {selectedCard && (
        <DetailedCardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          updateCard={(updatedCard) => {
            setPokemons((prev) =>
              prev.map((c) => (c.id === updatedCard.id ? updatedCard : c))
            );
            setSelectedCard(updatedCard);
          }}
        />
      )}
  </>
)}
        {view === "wishlist" && (
          <>
            <div className="header">
              <div>
                <h1 style={{ fontSize: "28px", fontWeight: "700" }}>
                  ❤️ Wishlist
                </h1>

                <p style={{ color: "#6b7280", marginTop: "4px" }}>
                  Cartas que queremos conseguir próximamente
                </p>
              </div>
            </div>

            <div
              className="search-box"
              style={{
                maxWidth: "100%",
                width: "100%",
                marginTop: "18px",
                marginBottom: "18px"
              }}
            >
              <input
                type="text"
                placeholder="🔍 Buscar carta para wishlist"
                style={{
                  width: "100%",
                  fontSize: "17px",
                  padding: "18px 22px",
                  borderRadius: "18px"
                }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading && (
              <p style={{ marginTop: "10px", color: "#6b7280" }}>
                🔍 Buscando cartas...
              </p>
            )}
            {!loading && results.length > 0 && (
              <p
                style={{
                  marginTop: "6px",
                  marginBottom: "10px",
                  color: "#6b7280",
                  fontSize: "14px",
                  fontWeight: "600"
                }}
              >
                {results.length} resultados encontrados
              </p>
            )}

            <div className="cards" style={{ marginTop: "20px" }}>
              {results.map((card) => {
                const alreadyExists = wishlist.find(
                  (w) => w.cardId === card.id
                );

                return (
                  <div key={card.id} className="card search-card">

                    <CardImage
                      card={card}
                      alt={card.name}
                      className={undefined}
                    />

                    <h3>{card.name}</h3>

                    <p className="price">
  {getPrice(card).toFixed(2)} €
</p>

                    <button
                      className="add-card-btn"
                      disabled={alreadyExists}
                      onClick={() => {
                        if (alreadyExists) return;

                        const updatedWishlist = [
  ...wishlist,
  {
    cardId: card.id,
    name: card.name,
    image: getCardImage(card, null),
    set: card.set?.name || "Unknown",
    number: card.number || "—",
    price: getPrice(card)
  }
];

setWishlist(updatedWishlist);

localStorage.setItem(
  "wishlist",
  JSON.stringify(updatedWishlist)
);

setSearch("");
setResults([]);
                      }}
                    >
                      {alreadyExists
                        ? "Añadida"
                        : "Añadir a wishlist"}
                    </button>

                  </div>
                );
              })}
            </div>

            {wishlist.length > 0 && (
              <>
                <h2
                  style={{
                    marginTop: "40px",
                    marginBottom: "18px",
                    fontSize: "24px"
                  }}
                >
                  ⭐ Mis cartas deseadas
                </h2>

                <div className="cards">
                  {wishlist.map((card, index) => (
                    <div key={index} className="card">

                      <CardImage
                        card={card}
                        alt={card.name}
                        className={undefined}
                      />

                      <h3>{card.name}</h3>

                      <div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginTop: "4px"
  }}
>
  <p className="card-sub">
    {card.set} · #{card.number}
  </p>

  <p
    style={{
      color: "#64748b",
      fontSize: "12px",
      fontWeight: "600",
      margin: 0
    }}
  >
    🌍 {(card.language || card.lang || "EN").toUpperCase()}
  </p>

  <p
    style={{
      color: "#4f46e5",
      fontSize: "12px",
      fontWeight: "700",
      margin: 0
    }}
  >
    ✨ {card.supertype || card.category || card.cardType || "Pokémon"}
  </p>
</div>

                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        {view === "top" && (
          <>
            <div className="header">
              <div>
                <h1 style={{ fontSize: "28px", fontWeight: "700" }}>
                  🏆 Top cartas
                </h1>

                <p style={{ color: "#6b7280", marginTop: "4px" }}>
                  Las cartas con mayor beneficio de la colección
                </p>
              </div>
            </div>

            <div
              className="cards"
              style={{
                marginTop: "24px",
                paddingBottom: "120px",
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(210px, 1fr))",
                gap: "18px",
                width: "100%",
                alignItems: "start",
                overflow: "visible"
              }}
            >
              {[...pokemons]
                .sort((a, b) => getProfit(b) - getProfit(a))
                .map((pokemon) => {

                  const profit = getProfit(pokemon);

                  return (
                    <div
                      key={pokemon.id}
                      className="card"
                      style={{
                        width: "100%",
                        maxWidth: "220px",
                        minWidth: 0,
                        justifySelf: "center"
                      }}
                    >

                      <CardImage
                        pokemon={pokemon}
                        alt={pokemon.name}
                        className={undefined}
                      />

                      <h3>{pokemon.name}</h3>

                      <p className="card-sub">
                        {pokemon.set} · #{pokemon.number}
                      </p>

                      

                      <p style={{ fontSize: "12px", color: "#6b7280" }}>
                        Compra: {pokemon.buyPrice?.toFixed(2)} €
                      </p>

                      <p className={profit >= 0 ? "profit positive" : "profit negative"}>
                        {profit >= 0 ? "↑" : "↓"} {profit.toFixed(2)} €
                      </p>
                      <a
                        href={getCardmarketUrl(pokemon)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          marginTop: "10px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          background: "#2563eb",
                          color: "white",
                          textDecoration: "none",
                          fontSize: "13px",
                          fontWeight: "700",
                          transition: "0.2s"
                        }}
                      >
                        Ver en Cardmarket
                      </a>

                    </div>
                  );
                })}
            </div>
          </>
        )}

        {/* ADD */}
        {view === "add" && (
          <>
            <div>
              <h1>Añadir carta</h1>
            </div>

            <div
              className="search-box"
              style={{
                maxWidth: "100%",
                width: "100%",
                marginTop: "18px",
                marginBottom: "18px"
              }}
            >
              <input
                type="text"
                placeholder="🔍 Buscar carta (ej: Charmander 168 o Pikachu VMAX)"
                style={{
                  width: "100%",
                  fontSize: "17px",
                  padding: "18px 22px",
                  borderRadius: "18px"
                }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "18px"
              }}
            >
              <button
                onClick={() => {
                  setManualMode(true);
                  setSelectedAddCard({
                    id: `manual-${Date.now()}`,
                    name: manualCard.name || "",
                    number: manualCard.number || "",
                    rarity: manualCard.rarity || "",
                    set: {
                      name: manualCard.set || "Manual"
                    },
                    images: {
                      large: manualCard.image || ""
                    },
                    source: "manual"
                  });
                }}
                style={{
                  padding: "14px 20px",
                  borderRadius: "14px",
                  border: "none",
                  background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
                  color: "white",
                  fontWeight: "800",
                  cursor: "pointer",
                  fontSize: "14px",
                  boxShadow: "0 10px 25px rgba(234,88,12,0.25)"
                }}
              >
                ✨ Añadir carta manualmente
              </button>
            </div>

            {loading && (
              <p style={{ marginTop: "10px", color: "#6b7280" }}>
                🔍 Buscando cartas...
              </p>
            )}

            <div className="cards">
              {results.map(card => {
                  const detectedLanguage = String(
                    card.language ||
                    card.lang ||
                    card.locale ||
                    card.languages?.[0] ||
                    (card.source === "tcgdex" ? "JP" : "EN")
                  ).toUpperCase();

                  return (
                    <div key={card.id} className="card search-card">

                      <CardImage
                        card={card}
                        alt={getDisplayName(card)}
                        className={undefined}
                      />

                      <h3>
  {getDisplayName(card)}
</h3>

                      <p className="card-sub">
                        {getDisplaySet(card)} · #{card.number || "—"}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          justifyContent: "center",
                          flexWrap: "wrap",
                          marginTop: "4px",
                          marginBottom: "8px"
                        }}
                      >
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "4px 8px",
                            borderRadius: "999px",
                            background: "#eef2ff",
                            color: "#4338ca",
                            fontWeight: "700"
                          }}
                        >
                          {getLanguageFlag(detectedLanguage)}
                        </span>

                        <span
                          style={{
                            fontSize: "10px",
                            padding: "4px 8px",
                            borderRadius: "999px",
                            background: "#f1f5f9",
                            color: "#475569",
                            fontWeight: "700"
                          }}
                        >
                          {card.rarity || "Sin rareza"}
                        </span>

                        <span
                          style={{
                            fontSize: "10px",
                            padding: "4px 8px",
                            borderRadius: "999px",
                            background:
                              card.source === "tcgdex"
                                ? "#fef3c7"
                                : "#dcfce7",
                            color:
                              card.source === "tcgdex"
                                ? "#92400e"
                                : "#166534",
                            fontWeight: "700"
                          }}
                        >
                          {card.source === "tcgdex"
                            ? "TCGdex"
                            : "PokemonTCG"}
                        </span>
                      </div>

                      <button
                        className="add-card-btn"
                        onClick={() => {
                          setSelectedAddCard(card);
                          setCustomBuyPrice("");
                          setMarketPrice1("");
                          setMarketPrice2("");
                          setMarketPrice3("");
                        }}
                      >
                        Añadir
                      </button>

                    </div>
                  );
                })}
            </div>
            {selectedAddCard && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(15,23,42,0.72)",
                  backdropFilter: "blur(8px)",
                  zIndex: 9999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px"
                }}
                onClick={() => setSelectedAddCard(null)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    maxWidth: "560px",
                    maxHeight: "92vh",
                    overflowY: "auto",
                    background: "white",
                    borderRadius: "28px",
                    padding: "28px",
                    boxShadow: "0 25px 80px rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255,255,255,0.2)"
                  }}
                >
                  {manualMode && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "14px",
                        marginBottom: "22px"
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Nombre carta"
                        value={manualCard.name}
                        onChange={(e) => {
                          const value = e.target.value;
                          setManualCard((prev) => ({ ...prev, name: value }));
                          setSelectedAddCard((prev) => ({
                            ...prev,
                            name: value
                          }));
                        }}
                        style={{
                          padding: "14px",
                          borderRadius: "14px",
                          border: "1px solid #d1d5db",
                          fontWeight: "600"
                        }}
                      />

                      <input
                        type="text"
                        placeholder="Set"
                        value={manualCard.set}
                        onChange={(e) => {
                          const value = e.target.value;
                          setManualCard((prev) => ({ ...prev, set: value }));
                          setSelectedAddCard((prev) => ({
                            ...prev,
                            set: { name: value }
                          }));
                        }}
                        style={{
                          padding: "14px",
                          borderRadius: "14px",
                          border: "1px solid #d1d5db",
                          fontWeight: "600"
                        }}
                      />

                      <input
                        type="text"
                        placeholder="Número"
                        value={manualCard.number}
                        onChange={(e) => {
                          const value = e.target.value;
                          setManualCard((prev) => ({ ...prev, number: value }));
                          setSelectedAddCard((prev) => ({
                            ...prev,
                            number: value
                          }));
                        }}
                        style={{
                          padding: "14px",
                          borderRadius: "14px",
                          border: "1px solid #d1d5db",
                          fontWeight: "600"
                        }}
                      />

                      <input
                        type="text"
                        placeholder="Rareza"
                        value={manualCard.rarity}
                        onChange={(e) => {
                          const value = e.target.value;
                          setManualCard((prev) => ({ ...prev, rarity: value }));
                          setSelectedAddCard((prev) => ({
                            ...prev,
                            rarity: value
                          }));
                        }}
                        style={{
                          padding: "14px",
                          borderRadius: "14px",
                          border: "1px solid #d1d5db",
                          fontWeight: "600"
                        }}
                      />

                      <input
                        type="text"
                        placeholder="URL imagen"
                        value={manualCard.image}
                        onChange={(e) => {
                          const value = e.target.value;
                          setManualCard((prev) => ({ ...prev, image: value }));
                          setSelectedAddCard((prev) => ({
                            ...prev,
                            images: {
                              large: value
                            }
                          }));
                        }}
                        style={{
                          gridColumn: "1 / -1",
                          padding: "14px",
                          borderRadius: "14px",
                          border: "1px solid #d1d5db",
                          fontWeight: "600"
                        }}
                      />

                      <div className="upload-image-section">
                        <input
                          type="file"
                          accept="image/*"
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                          style={{ marginTop: "10px" }}
                        />

                        {previewImage && (
                          <img
                            key={previewImage}
                            src={previewImage}
                            alt="Preview"
                            style={{
                              width: "220px",
                              height: "307px",
                              objectFit: "cover",
                              marginTop: "15px",
                              borderRadius: "12px",
                              boxShadow: "0 0 10px rgba(0,0,0,0.4)",
                              display: "block"
                            }}
                          />
                        )}
                      </div>

                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: "20px",
                      marginBottom: "24px",
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}
                  >
                    <CardImage
                      card={selectedAddCard}
                      alt={selectedAddCard?.name || "Pokemon card"}
                      className={undefined}
                      style={{
                        width: "220px",
                        height: "307px",
                        objectFit: "cover",
                        borderRadius: "18px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
                        background: "#fff",
                        display: "block"
                      }}
                    />

                    <div>
                      <h2
                        style={{
                          fontSize: "26px",
                          fontWeight: "800",
                          marginBottom: "6px",
                          color: "#111827"
                        }}
                      >
                        {getDisplayName(selectedAddCard)}
                      </h2>

                      <p
                        style={{
                          color: "#6b7280",
                          fontSize: "15px",
                          fontWeight: "600"
                        }}
                      >
                        {getDisplaySet(selectedAddCard)} · #{selectedAddCard.number || "—"}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: "18px"
                    }}
                  >
                    <div
                      style={{
                        background: "#f8fafc",
                        borderRadius: "18px",
                        padding: "18px",
                        border: "1px solid #e2e8f0"
                      }}
                    >
                      <label
                        style={{
                          display: "block",
                          fontWeight: "700",
                          marginBottom: "10px",
                          color: "#111827"
                        }}
                      >
                        🌍 Idioma colección
                      </label>

                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "14px",
                          borderRadius: "14px",
                          border: "1px solid #d1d5db",
                          fontSize: "15px",
                          fontWeight: "600"
                        }}
                      >
                        <option value="EN">🇬🇧 Inglés</option>
                        <option value="ES">🇪🇸 Español</option>
                        <option value="JP">🇯🇵 Japonés</option>
                      </select>
                    </div>

                    <div
                      style={{
                        background: "#f8fafc",
                        borderRadius: "18px",
                        padding: "18px",
                        border: "1px solid #e2e8f0"
                      }}
                    >
                      <label
                        style={{
                          display: "block",
                          fontWeight: "700",
                          marginBottom: "10px",
                          color: "#111827"
                        }}
                      >
                        💰 Precio de compra
                      </label>

                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ej: 85"
                        value={customBuyPrice}
                        onChange={(e) => setCustomBuyPrice(e.target.value.replace(',', '.'))}
                        style={{
                          width: "100%",
                          padding: "14px",
                          borderRadius: "14px",
                          border: "1px solid #d1d5db",
                          fontSize: "15px",
                          fontWeight: "600",
                          boxSizing: "border-box"
                        }}
                      />
                    </div>

                    <div
                      style={{
                        background: "linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)",
                        borderRadius: "18px",
                        padding: "18px",
                        border: "1px solid #c7d2fe"
                      }}
                    >
                      <label
                        style={{
                          display: "block",
                          fontWeight: "800",
                          marginBottom: "14px",
                          color: "#312e81",
                          fontSize: "16px"
                        }}
                      >
                        📈 Precios Cardmarket
                      </label>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                          gap: "12px",
                          width: "100%"
                        }}
                      >
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Precio 1"
                          value={marketPrice1}
                          onChange={(e) => setMarketPrice1(e.target.value.replace(',', '.'))}
                          style={{
                            padding: "14px",
                            borderRadius: "14px",
                            border: "1px solid #c7d2fe",
                            fontWeight: "700",
                            textAlign: "center",
                            fontSize: "15px",
                            width: "100%",
                            boxSizing: "border-box"
                          }}
                        />

                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Precio 2"
                          value={marketPrice2}
                          onChange={(e) => setMarketPrice2(e.target.value.replace(',', '.'))}
                          style={{
                            padding: "14px",
                            borderRadius: "14px",
                            border: "1px solid #c7d2fe",
                            fontWeight: "700",
                            textAlign: "center",
                            fontSize: "15px",
                            width: "100%",
                            boxSizing: "border-box"
                          }}
                        />

                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Precio 3"
                          value={marketPrice3}
                          onChange={(e) => setMarketPrice3(e.target.value.replace(',', '.'))}
                          style={{
                            padding: "14px",
                            borderRadius: "14px",
                            border: "1px solid #c7d2fe",
                            fontWeight: "700",
                            textAlign: "center",
                            fontSize: "15px",
                            width: "100%",
                            boxSizing: "border-box"
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginTop: "26px"
                    }}
                  >
                    <button
                      onClick={() => {
                        setSelectedAddCard(null);
                        setManualMode(false);
                      }}
                      style={{
                        flex: 1,
                        padding: "16px",
                        borderRadius: "16px",
                        border: "1px solid #d1d5db",
                        background: "white",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        try {
                          await addPokemon(selectedAddCard);

                          alert("Carta añadida correctamente");

                          setSelectedAddCard(null);
                          setManualMode(false);

                          setManualCard({
                            name: "",
                            set: "",
                            number: "",
                            image: "",
                            rarity: "",
                          });
                        } catch (err) {
                          console.error("ERROR FIREBASE:", err);
                          alert(err.message || "Error al añadir carta");
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: "16px",
                        borderRadius: "16px",
                        border: "none",
                        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                        color: "white",
                        fontWeight: "800",
                        cursor: "pointer",
                        boxShadow: "0 10px 25px rgba(79,70,229,0.35)",
                        transition: "0.2s ease"
                      }}
                    >
                      ✨ Añadir a colección
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </main>
    </div>
  );
}

export default App;
// Detailed Card Modal component
function DetailedCardModal({ card, onClose, updateCard }) {
  const [editableSales, setEditableSales] = useState(["", "", ""]);
  const [editing, setEditing] = useState(false);
  const overlayRef = useRef(null);

  // Initialize editableSales when card changes
  React.useEffect(() => {
    if (card && Array.isArray(card.manualPrices)) {
      setEditableSales([
        card.manualPrices[0]?.toString() ?? "",
        card.manualPrices[1]?.toString() ?? "",
        card.manualPrices[2]?.toString() ?? "",
      ]);
    } else {
      setEditableSales(["", "", ""]);
    }
    setEditing(false);
  }, [card]);

  // Close modal on click outside
  React.useEffect(() => {
    function handleClick(e) {
      if (
        overlayRef.current &&
        e.target === overlayRef.current
      ) {
        onClose();
      }
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Animate modal on mount
  const [show, setShow] = useState(false);
  React.useEffect(() => {
    setShow(true);
    return () => setShow(false);
  }, []);

  // Calculate current price
  const getManualAvg = () => {
    const nums = editableSales.map((v) => Number(v)).filter((v) => !isNaN(v) && v > 0);
    if (nums.length === 0) return 0;
    return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
  };

  // Weekly chart data
  let weeklyData = [];
  if (Array.isArray(card.history) && card.history.length > 0) {
    // Take last 7 days, or fill with mock if not enough
    const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const byDay = {};
    card.history.forEach((entry) => {
      const d = new Date(entry.date);
      const day = d.getDay();
      byDay[day] = entry.price;
    });
    // Use most recent 7 entries or fill mock
    weeklyData = days.map((day, idx) => ({
      day,
      price:
        card.history[card.history.length - 7 + idx]?.price ??
        [
          12, 13, 12.5, 14, 15, 14.2, 15.4
        ][idx],
    }));
  } else {
    weeklyData = [
      { day: "Lun", price: 12 },
      { day: "Mar", price: 13 },
      { day: "Mié", price: 12.5 },
      { day: "Jue", price: 14 },
      { day: "Vie", price: 15 },
      { day: "Sáb", price: 14.2 },
      { day: "Dom", price: 15.4 },
    ];
  }

  // Chart points for SVG
  const maxPrice = Math.max(...weeklyData.map((d) => d.price));
  const minPrice = Math.min(...weeklyData.map((d) => d.price));
  const points = weeklyData.map((d, i) => {
    // x: 10 + i * (80/6), y: 72 - scaled
    const x = 10 + (i / 6) * 80;
    const y =
      72 -
      ((d.price - minPrice) / (maxPrice - minPrice || 1)) * 48;
    return { ...d, x, y };
  });
  const chartPath = points
    .map((pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = points[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return `C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    })
    .join(" ");
  const areaPath = `
    ${chartPath}
    L 100 84
    L 0 84
    Z
  `;

  // Responsive 2-column: stack on mobile
  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      style={{
        animation: show
          ? "fadeInModal 0.23s cubic-bezier(.4,2,.6,1)"
          : "none",
      }}
    >
      <div
        className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 shadow-2xl"
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "0px",
          width: "100%",
          maxHeight: "92vh",
          minHeight: "340px",
          boxShadow: "0 25px 80px rgba(0,0,0,0.45)",
          animation: show
            ? "modalPopIn 0.23s cubic-bezier(.4,2,.6,1)"
            : "none",
        }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          style={{
            fontSize: "24px",
            fontWeight: "700",
            boxShadow: "0 2px 8px rgba(0,0,0,0.09)",
            border: "none",
          }}
        >
          ✕
        </button>
        {/* Left: Card image and name */}
        <div
          className="flex flex-col items-center justify-center p-8"
          style={{
            minWidth: "0",
            flex: "1 1 320px",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(135deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0.02) 100%)",
            borderRight: "1px solid rgba(255,255,255,0.07)",
            position: "relative",
            maxWidth: "420px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div
            className="group"
            style={{
              borderRadius: "22px",
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
              background: "#18181b",
              border: "2px solid #334155",
              padding: "8px",
              transition: "transform 0.18s cubic-bezier(.4,2,.6,1), box-shadow 0.18s",
              cursor: "pointer",
              width: "260px",
              height: "360px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={getCardImage(card, null)}
              alt={card.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "16px",
                transition: "transform 0.2s cubic-bezier(.4,2,.6,1)",
                boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
              }}
              className="hover:scale-105 transition"
            />
          </div>
          <h2
            style={{
              color: "#fff",
              fontSize: "24px",
              fontWeight: "800",
              marginTop: "10px",
              textAlign: "center",
              textShadow: "0 2px 6px rgba(0,0,0,0.17)",
            }}
          >
            {card.name}
          </h2>
        </div>
        {/* Right: Details */}
        <div
          className="flex-1 flex flex-col gap-7 p-8 overflow-y-auto"
          style={{
            minWidth: "0",
            flex: "2 1 400px",
            color: "#f1f5f9",
            position: "relative",
            width: "100%",
            maxHeight: "92vh",
          }}
        >
          <div style={{ marginBottom: "6px" }}>
            <h2
              style={{
                fontSize: "27px",
                fontWeight: "800",
                color: "#fff",
                marginBottom: "2px",
                lineHeight: 1.13,
              }}
            >
              {card.name}
            </h2>
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
                marginBottom: "3px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  background: "#312e81",
                  color: "#f1f5f9",
                  padding: "6px 18px",
                  borderRadius: "999px",
                  fontWeight: "700",
                  fontSize: "14px",
                  letterSpacing: "0.03em",
                  opacity: 0.93,
                }}
              >
                {getDisplaySet(card)}
              </span>
              <span
                style={{
                  background: "#1e293b",
                  color: "#dbeafe",
                  padding: "6px 18px",
                  borderRadius: "999px",
                  fontWeight: "700",
                  fontSize: "14px",
                  letterSpacing: "0.03em",
                  opacity: 0.93,
                }}
              >
                #{card.number}
              </span>
              <span
                style={{
                  background: "#334155",
                  color: "#facc15",
                  padding: "6px 18px",
                  borderRadius: "999px",
                  fontWeight: "700",
                  fontSize: "14px",
                  letterSpacing: "0.03em",
                  opacity: 0.93,
                }}
              >
                {card.rarity || "Sin rareza"}
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "18px",
              alignItems: "center",
              marginBottom: "2px",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                fontWeight: "700",
                color: "#22d3ee",
                background: "#0e7490",
                borderRadius: "12px",
                padding: "8px 20px",
                boxShadow: "0 2px 7px rgba(14,116,144,0.12)",
                marginRight: "6px",
              }}
            >
              {getManualAvg().toFixed(2)} €
            </span>
            <span
              style={{
                fontSize: "15px",
                color: "#a3e635",
                background: "#365314",
                borderRadius: "12px",
                padding: "7px 18px",
                fontWeight: "600",
                opacity: 0.93,
              }}
            >
              Compra: {card.buyPrice?.toFixed(2) ?? "—"} €
            </span>
            <a
              href={getCardmarketUrl(card)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "14px",
                color: "#fff",
                background: "linear-gradient(90deg,#2563eb 0%,#4f46e5 100%)",
                borderRadius: "12px",
                padding: "8px 20px",
                fontWeight: "700",
                textDecoration: "none",
                marginLeft: "8px",
                transition: "background 0.15s",
                boxShadow: "0 2px 9px rgba(37,99,235,0.11)",
              }}
            >
              Ver en Cardmarket
            </a>
          </div>
          {/* Ventas Cardmarket */}
          <div
            style={{
              background: "linear-gradient(135deg,#18181b 0%,#27272a 100%)",
              borderRadius: "22px",
              padding: "22px",
              border: "1px solid #334155",
              marginBottom: "3px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.11)",
              maxWidth: "420px",
              width: "100%",
            }}
          >
            <div
              style={{
                fontWeight: "800",
                fontSize: "18px",
                letterSpacing: "-0.04em",
                color: "#fbbf24",
                marginBottom: "17px",
              }}
            >
              Ventas Cardmarket
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "14px",
                marginBottom: "8px",
              }}
            >
              {["Venta 1", "Venta 2", "Venta 3"].map((label, idx) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label
                    htmlFor={`venta${idx + 1}`}
                    style={{
                      color: "#e0e7ef",
                      fontWeight: "700",
                      fontSize: "13px",
                      marginBottom: "2px",
                      opacity: 0.85,
                    }}
                  >
                    {label}
                  </label>
                  <input
                    id={`venta${idx + 1}`}
                    type="text"
                    inputMode="decimal"
                    value={editableSales[idx]}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      setEditableSales((prev) => {
                        const arr = [...prev];
                        arr[idx] = val;
                        return arr;
                      });
                      setEditing(true);
                    }}
                    style={{
                      padding: "12px",
                      borderRadius: "12px",
                      border: "1px solid #334155",
                      background: "#18181b",
                      color: "#fbbf24",
                      fontWeight: "700",
                      textAlign: "center",
                      fontSize: "15px",
                      outline: "none",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.11)",
                      transition: "border 0.13s",
                    }}
                  />
                </div>
              ))}
            </div>
            <button
              className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-white transition hover:bg-emerald-400"
              style={{
                marginTop: "16px",
                fontWeight: "800",
                fontSize: "16px",
                letterSpacing: "0.01em",
                width: "100%",
                border: "none",
                borderRadius: "18px",
                boxShadow: "0 2px 8px rgba(16,185,129,0.13)",
                cursor: "pointer",
                opacity: editing ? 1 : 0.7,
                pointerEvents: editing ? "auto" : "none",
                transition: "background 0.15s, opacity 0.15s",
              }}
              onClick={async () => {
                // Save prices to card and update average
                const manualPrices = editableSales.map((v) => Number(v));
                const avg =
                  manualPrices.filter((v) => !isNaN(v) && v > 0).length > 0
                    ? Number(
                        (
                          manualPrices.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0) /
                          manualPrices.filter((v) => !isNaN(v) && v > 0).length
                        ).toFixed(2)
                      )
                    : 0;
                const updated = {
                  ...card,
                  manualPrices,
                  manualPrice: avg,
                  price: avg,
                };
                updateCard(updated);
                setEditing(false);
              }}
              disabled={!editing}
            >
              Guardar precios
            </button>
          </div>
          {/* Weekly chart section */}
          <div
            style={{
              background: "linear-gradient(135deg,#18181b 0%,#27272a 100%)",
              borderRadius: "22px",
              padding: "22px",
              border: "1px solid #334155",
              marginBottom: "3px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.11)",
              maxWidth: "520px",
              width: "100%",
            }}
          >
            <div
              style={{
                fontWeight: "800",
                fontSize: "18px",
                letterSpacing: "-0.04em",
                color: "#60a5fa",
                marginBottom: "17px",
              }}
            >
              Evolución semanal
            </div>
            <div style={{ width: "100%", height: "160px" }}>
              <svg
                viewBox="0 0 120 100"
preserveAspectRatio="xMidYMid meet"
                style={{ width: "100%", height: "100%", overflow: "visible" }}
              >
                <defs>
                  <linearGradient id="gradientAreaCard" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
                  </linearGradient>
                  <filter id="softGlowCard">
                    <feGaussianBlur stdDeviation="1.4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* GRID */}
                {[20, 35, 50, 65, 80].map((line) => (
                  <line
                    key={line}
                    x1="0"
                    y1={line}
                    x2="100"
                    y2={line}
                    stroke="#334155"
                    strokeWidth="0.8"
                  />
                ))}
                {/* PRECIOS LATERALES */}
                {[
                  { y: 20, value: `${(maxPrice * 1.0).toFixed(0)} €` },
                  { y: 50, value: `${((maxPrice + minPrice) / 2).toFixed(1)} €` },
                  { y: 80, value: `${minPrice.toFixed(0)} €` },
                ].map((label) => (
                  <text
                    key={label.value}
                    x="2"
                    y={label.y}
                    textAnchor="start"
                    fontSize="2.8"
                    fill="#64748b"
                    fontWeight="500"
                  >
                    {label.value}
                  </text>
                ))}
                {/* DÍAS */}
                {points.map((point) => (
                  <text
                    key={point.day}
                    x={point.x}
                    y="91"
                    textAnchor="middle"
                    fontSize="3.4"
                    fill="#94a3b8"
                    fontWeight="700"
                  >
                    {point.day}
                  </text>
                ))}
                {/* ÁREA */}
                <path
                  d={areaPath}
                  fill="url(#gradientAreaCard)"
                />
                {/* LÍNEA */}
                <path
                  d={chartPath}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  filter="url(#softGlowCard)"
                />
                {/* PUNTOS + TOOLTIP */}
                {points.map((point, index) => (
                  <g key={index}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="1.8"
                      fill="#ffffff"
                      stroke="#60a5fa"
                      strokeWidth="1.2"
                    >
                      <title>{`${point.day} · ${point.price.toFixed(2)} €`}</title>
                    </circle>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
        {/* Responsive stacking for mobile (media queries in CSS, or flex-direction: column on small screens) */}
      </div>
      <style>
        {`
        @media (max-width: 900px) {
          .fixed.inset-0.z-50 > div.relative.w-full.max-w-6xl {
            flex-direction: column !important;
            max-width: 98vw !important;
          }
          .fixed.inset-0.z-50 > div.relative.w-full.max-w-6xl > .flex.flex-col.items-center.justify-center.p-8 {
            max-width: 100vw !important;
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.07);
            min-height: 0;
            padding-bottom: 16px;
          }
          .fixed.inset-0.z-50 > div.relative.w-full.max-w-6xl > .flex-1.flex.flex-col.gap-7.p-8.overflow-y-auto {
            min-width: 0;
            width: 100% !important;
            max-height: 300px;
            padding-top: 16px;
          }
        }
        @media (max-width: 600px) {
          .fixed.inset-0.z-50 > div.relative.w-full.max-w-6xl {
            padding: 0 !important;
            max-width: 100vw !important;
          }
        }
        @keyframes fadeInModal {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalPopIn {
          from { transform: scale(0.95) translateY(15px); opacity: 0.65; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        `}
      </style>
    </div>
  );
}