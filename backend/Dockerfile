FROM node:22.19.0-alpine


# Directorio de trabajo: replica el layout de dev (CRM/backend/) para que las rutas
# relativas en el código (__dirname + '../../uploads') caigan en /usr/src/app/uploads,
# que es donde el bind mount del host persiste los archivos.
WORKDIR /usr/src/app/backend


# Copiar archivos: Copia el archivo de configuración del paquete y tus archivos de aplicación al contenedor:
COPY package*.json ./


# Instalar dependencias: Instala las dependencias necesarias:
RUN npm install


COPY . .



# Exponer el puerto: Expón es puerto que tu aplicación usa, por ejemplo, el 3000:
EXPOSE 3001


# Comando para iniciar la aplicación: Finalmente, especifica el comando para iniciar tu aplicación:
CMD ["npx",  "tsx",  "src/server.ts"]
