# ============================================
# STAGE 1: Builder (Construcción)
# ============================================
FROM node:20-alpine AS builder

# Metadata
LABEL maintainer="carlosbalaguer5@gmail.com"
LABEL description="Slack Clone Backend - Builder Stage"

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero
# Si package.json no cambia, Docker reutiliza este layer (más rápido)
COPY package*.json ./

# Instalar TODAS las dependencias (dev + prod)
# Necesarias para compilar TypeScript
RUN npm ci

# Copiar código fuente
COPY . .

# Compilar TypeScript a JavaScript
RUN npm run build

# Limpiar devDependencies (ya no se necesitan)
# Solo dejamos dependencias de producción
RUN npm prune --production

# ============================================
# STAGE 2: Runner (Producción)
# ============================================
FROM node:20-alpine AS runner

# Metadata
LABEL maintainer="carlosbalaguer5@gmail.com"
LABEL description="Slack Clone Backend - Production"

# Instalar dumb-init (mejor manejo de señales SIGTERM)
RUN apk add --no-cache dumb-init

# Crear usuario no-root (seguridad)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Establecer directorio de trabajo
WORKDIR /app

# Copiar solo lo necesario desde builder
# Solo node_modules de producción (sin devDependencies)
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copiar código compilado (JavaScript, no TypeScript)
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copiar package.json (puede ser necesario para algunas dependencias)
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Cambiar a usuario no-root (seguridad)
USER nodejs

# Exponer puerto
EXPOSE 3001

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Ejecutar con dumb-init (mejor manejo de señales)
CMD ["dumb-init", "node", "dist/src/index.js"]