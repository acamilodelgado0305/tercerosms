import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import CajeroRutas from './routes/Cajero.js';



const app = express();
import dotenv from "dotenv";

// Incluye los módulos necesarios para la autenticación

app.use(cookieParser());
app.use(
  cors({
    credentials: true,
    origin: ["https://ispsuite.app.la-net.co", "http://localhost:5173"],
  })
);
app.use(express.json());

// Middleware para manejar errores
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  // Puedes enviar una respuesta de error al cliente o realizar otras acciones aquí
  res.status(500).send("Error interno del servidor");
});

const PORT = process.env.PORT || 3005;

// Rutas protegidas (requieren autenticación)

app.use("/api", CajeroRutas);




// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor en ejecución en http://localhost:${PORT}`);
});

export default app;
