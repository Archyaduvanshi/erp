# Deployment Guide

Target setup:

- Frontend: Vercel
- Backend: Render
- Database: Neon Postgres

## 1. Create the Neon database

Create a Neon project and database, then copy the connection details from the
Neon dashboard.

Use these values for the backend:

- Host: the Neon host, usually ending in `.neon.tech`
- Database: the Neon database name
- User: the Neon role/user
- Password: the Neon password

For Spring Boot, the JDBC URL should look like this:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://YOUR_NEON_HOST/YOUR_DATABASE?sslmode=require
SPRING_DATASOURCE_USERNAME=YOUR_NEON_USER
SPRING_DATASOURCE_PASSWORD=YOUR_NEON_PASSWORD
```

## 2. Deploy the backend on Render

Create a Render web service from the GitHub repository.

Important: Render's current native runtimes do not include Java/Spring Boot. To
deploy this backend on Render, use Render's Docker runtime with a backend
`Dockerfile`, or choose a Java-native backend host instead. If Docker is allowed
again for deployment, use these service settings:

- Root Directory: `backend`
- Runtime: Docker
- Health Check Path: `/api/health`

If deploying on a Java-native host, use these equivalent commands:

- Build Command: `./mvnw -B clean package -DskipTests`
- Start Command: `java -jar target/backend-0.0.1-SNAPSHOT.jar`

Set these environment variables in the backend hosting dashboard:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://HOST:PORT/DATABASE
SPRING_DATASOURCE_USERNAME=YOUR_DB_USER
SPRING_DATASOURCE_PASSWORD=YOUR_DB_PASSWORD
SPRING_JPA_HIBERNATE_DDL_AUTO=update
SPRING_JPA_SHOW_SQL=false
SPRING_JPA_PROPERTIES_HIBERNATE_FORMAT_SQL=false
APP_CORS_ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN.vercel.app
# Optional, useful for Vercel preview URLs:
APP_CORS_ALLOWED_ORIGIN_PATTERNS=https://*.vercel.app
IMAGEKIT_PRIVATE_KEY=YOUR_IMAGEKIT_PRIVATE_KEY
IMAGEKIT_PUBLIC_KEY=YOUR_IMAGEKIT_PUBLIC_KEY
IMAGEKIT_URL_ENDPOINT=YOUR_IMAGEKIT_URL_ENDPOINT
IMAGEKIT_DEFAULT_FOLDER=/erp
```

Do not upload `.env` or `.env.local` files to GitHub.

For Neon, remember to include `?sslmode=require` in `SPRING_DATASOURCE_URL`.

## 3. Deploy the frontend on Vercel

Create a Vercel project from the same GitHub repository.

- Root Directory: `frontend`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Set this environment variable in Vercel:

```env
VITE_API_BASE_URL=https://YOUR_BACKEND_DOMAIN.onrender.com/api
```

After changing `VITE_API_BASE_URL`, redeploy the frontend.

## 4. Connect frontend and backend

After Vercel gives you the production frontend URL, update the backend CORS
setting:

```env
APP_CORS_ALLOWED_ORIGINS=https://erpfrontend-kohl.vercel.app
```

If you use a custom frontend domain, add that exact domain too:

```env
APP_CORS_ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN.vercel.app,https://YOUR_CUSTOM_DOMAIN.com
```

## 5. Final checks

- Backend health URL should return JSON: `https://YOUR_BACKEND_DOMAIN/api/health`
- Frontend should open without a 404 on routes like `/college` or `/login`
- Register/login should create and read data from the production database
