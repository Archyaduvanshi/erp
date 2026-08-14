# Deployment Guide

Recommended setup:

- Frontend: Vercel
- Backend: Render or Railway
- Database: Supabase Postgres, Neon Postgres, Render Postgres, or Railway Postgres

## Backend

Create a web service from the GitHub repository.

For Render:

- Root Directory: `backend`
- Runtime: Java
- Build Command: `mvn -B clean package -DskipTests`
- Start Command: `java -jar target/backend-0.0.1-SNAPSHOT.jar`
- Health Check Path: `/api/health`

Set these environment variables in the hosting dashboard:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://HOST:PORT/DATABASE
SPRING_DATASOURCE_USERNAME=YOUR_DB_USER
SPRING_DATASOURCE_PASSWORD=YOUR_DB_PASSWORD
SPRING_JPA_HIBERNATE_DDL_AUTO=update
SPRING_JPA_SHOW_SQL=false
SPRING_JPA_PROPERTIES_HIBERNATE_FORMAT_SQL=false
APP_CORS_ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN.vercel.app
IMAGEKIT_PRIVATE_KEY=YOUR_IMAGEKIT_PRIVATE_KEY
IMAGEKIT_PUBLIC_KEY=YOUR_IMAGEKIT_PUBLIC_KEY
IMAGEKIT_URL_ENDPOINT=YOUR_IMAGEKIT_URL_ENDPOINT
IMAGEKIT_DEFAULT_FOLDER=/erp
```

Do not upload `.env` or `.env.local` files to GitHub.

## Frontend

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

## Final Checks

- Backend health URL should return JSON: `https://YOUR_BACKEND_DOMAIN/api/health`
- Frontend should open without a 404 on routes like `/college` or `/login`
- Register/login should create and read data from the production database
