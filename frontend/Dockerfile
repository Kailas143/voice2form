# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# We don't define env vars here. They should be passed as build args if needed,
# or we use relative paths for API (which we do via Nginx reverse proxy).
# However, VITE_API_BASE_URL should be empty or point to the root because Nginx will proxy /api to backend.
ENV VITE_API_BASE_URL=""

RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
