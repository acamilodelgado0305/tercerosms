import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

export const authMiddleware = (req, res, next) => {
    // 1. Obtener el token de la cabecera de autorización
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 2. Verificar y decodificar el token
        const decodedPayload = jwt.verify(token, JWT_SECRET);
        
        // 3. ¡El paso clave! Adjuntar el payload al objeto `req`
        req.user = decodedPayload;
        
        // 4. Continuar hacia el siguiente middleware o controlador
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido o expirado.' });
    }
};


export const verifyInternalApiKey = (req, res, next) => {
    const apiKey = req.headers['x-internal-api-key'];

    if (apiKey && apiKey === process.env.INTERNAL_API_KEY) {
        return next();
    }

    res.status(401).json({ message: 'Acceso no autorizado.' });
};