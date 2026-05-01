/* In /Users/Danny/pokemon-app/src/App.css */

.sidebar {
  overflow: visible;
  /* other styles remain unchanged */
}

/* 🔥 CHARIZARD FLOAT */
.charizard-float {
  position: absolute;
  top: 120px;
  right: -35px;

  width: 170px;

  opacity: 0.95;

  pointer-events: none;

  z-index: 10;

  animation: charizardFly 8s ease-in-out infinite;

  filter:
    drop-shadow(0 0 22px rgba(249,115,22,0.35));
}

.charizard-float img {
  width: 100%;
  object-fit: contain;
}

@keyframes charizardFly {
  0% {
    transform: translateY(0px) translateX(0px);
  }

  50% {
    transform: translateY(-14px) translateX(-10px);
  }

  100% {
    transform: translateY(0px) translateX(0px);
  }
}


/* In /Users/Danny/pokemon-app/src/App.jsx */

<aside className="sidebar">
  <div className="charizard-float">
    <img
      src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png"
      alt="Charizard"
    />
  </div>
  <div className="mew-float">
    {/* existing content */}
  </div>
  {/* other aside content */}
</aside>
