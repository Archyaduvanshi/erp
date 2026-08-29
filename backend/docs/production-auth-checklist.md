# Production Auth Checklist

- Serve frontend and backend only over HTTPS.
- Set `SPRING_PROFILES_ACTIVE=prod`.
- Set `APP_AUTH_SECURE_COOKIES=true`.
- Set `APP_CORS_ALLOWED_ORIGINS` to exact frontend origins only, for example `https://app.example.com`.
- Leave `APP_CORS_ALLOWED_ORIGIN_PATTERNS` empty unless a reviewed wildcard is truly required.
- Set `APP_AUTH_TRUSTED_PROXY_ADDRESSES` to the load balancer or reverse proxy IPs that are allowed to provide `X-Forwarded-For`.
- Set `APP_AUTH_PASSWORD_RESET_WEBHOOK_URL` to a working email/SMS delivery endpoint.
- Set `APP_AUTH_PASSWORD_RESET_URL_BASE` to the production frontend reset URL, for example `https://app.example.com/reset-password`.
- Keep `APP_AUTH_EXPOSE_RESET_TOKEN=false`.
- Use a unique `APP_AUTH_JWT_SECRET` with at least 32 characters and rotate it through the deployment secret manager.
