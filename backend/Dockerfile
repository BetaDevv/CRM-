FROM node:22.19.0-alpine


# Directorio de trabajo: Define un directorio de trabajo en el contenedor:
WORKDIR /usr/src/app


# Copiar archivos: Copia el archivo de configuración del paquete y tus archivos de aplicación al contenedor:
COPY package*.json ./


# Instalar dependencias: Instala las dependencias necesarias:
RUN npm install


COPY . .



# Exponer el puerto: Expón es puerto que tu aplicación usa, por ejemplo, el 3000:
EXPOSE 3001


# Comando para iniciar la aplicación: Finalmente, especifica el comando para iniciar tu aplicación:
CMD ["npx",  "tsx",  "src/server.ts"]
