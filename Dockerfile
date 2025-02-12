# Usa una imagen oficial de Node.js como imagen base
FROM node:21.7.1

# Establece el directorio de trabajo
WORKDIR /src/index

# Copia el package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto de la aplicación
COPY . .

# Expone el puerto que usa la aplicación
EXPOSE 3002

# Comando para ejecutar la aplicación
CMD [ "npm", "start" ]
