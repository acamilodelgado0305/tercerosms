import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import CajerosRouter from './routes/cajero.routes.js';
import ProviderRouter from './routes/providers.routes.js'
import TercerosRouter from './routes/tercerosRoutes.js'
import internalRoutes from './routes/internalRoutes.js';


dotenv.config();

const app = express();

// Middleware para parsear el cuerpo de las peticiones JSON
app.use(express.json());

// Configuración de CORS (para aceptar peticiones de tu frontend)
app.use(cors({
    origin: ['http://localhost:5173', 'https://ispsuite.app.la-net.co', 'https://ispsuitedev.app.la-net.co','http://localhost:3002', 'https://backdev.app.la-net.co',"http://localhost:3009" ],
    credentials: true,
}));

app.use('/api/internal/terceros', internalRoutes);
app.use("/api", CajerosRouter);
app.use("/api", ProviderRouter);
app.use("/api", TercerosRouter);


// Inicia el servidor HTTP
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor en ejecución en el puerto ${PORT}`);
});

// Exportar la instancia de io para usarla en otros archivos si es necesario

