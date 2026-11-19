
# ==========================================
# STAGE 1: BUILD STAGE
# ==========================================

# Use Node.js 22 Alpine as the base image.
# Alpine is a lightweight Linux distribution.
# AS build gives this stage the name "build".
FROM node:22-alpine AS build

# Set the working directory inside the container.
WORKDIR /app

# Copy package manifests first so dependency installation can be cached.
COPY package*.json ./

# Install the exact dependency versions recorded in package-lock.json.
RUN npm ci

# Copy the remaining frontend source code into /app.
COPY . .

# Vite replaces VITE_* environment variables during build time.
# Therefore, this variable must be provided before npm run build.
ARG VITE_API_BASE_URL=http://localhost:8081

# Make the build argument available as an environment variable.
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the React + Vite application.
# Generates optimized static files inside /app/dist.
RUN npm run build


# ==========================================
# STAGE 2: PRODUCTION STAGE
# ==========================================

# Use lightweight Nginx image to serve static frontend files.
FROM nginx:alpine

# Copy the production build output from Stage 1.
# /app/dist contains the generated HTML, CSS and JavaScript files.
# Nginx serves these files from /usr/share/nginx/html.
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Document that the container listens on port 80.
EXPOSE 80

# Start Nginx in the foreground.
# This keeps the container running.
CMD ["nginx", "-g", "daemon off;"]
