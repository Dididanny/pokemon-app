import React from 'react'
import ReactDOM from 'react-dom/client'
import App from "./App.jsx";

console.log("ESTE ES EL APP REAL");
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)