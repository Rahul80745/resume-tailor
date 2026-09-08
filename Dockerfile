FROM node:24-slim
 
WORKDIR /app
 
# Copy everything in one shot
COPY . .
 
# Install server dependencies
RUN cd server && npm install --omit=dev
 
# Install client dependencies and build the frontend
RUN cd client && npm install && npm run build
 
# Verify the files actually exist (shows in build logs)
RUN echo "=== FILES IN /app/server/src ===" && ls -la /app/server/src/
 
# Database on persistent volume
ENV DB_PATH=/data/app.db
ENV PORT=8080
ENV NODE_ENV=production
 
RUN mkdir -p /data
 
EXPOSE 8080
 
CMD ["node", "server/src/index.js"]