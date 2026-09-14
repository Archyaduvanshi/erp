package com.erp.backend.publicsite;

import com.erp.backend.auth.ClientIpResolver;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;

// Installed in the security chain, after CORS and before request body binding.
public class PublicRequestFilter extends OncePerRequestFilter {
    private final PublicRateLimitService limiter;
    private final ClientIpResolver ip;
    public PublicRequestFilter(PublicRateLimitService limiter, ClientIpResolver ip) { this.limiter=limiter; this.ip=ip; }
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        return !isPublicRequest(request.getMethod(), request.getRequestURI());
    }
    public static boolean isPublicRequest(String method, String path) {
        return ("GET".equals(method) && (path.equals("/api/public/plans") || path.equals("/api/public/config")))
                || ("POST".equals(method) && (path.equals("/api/public/demo-requests") || path.equals("/api/institutes/register")));
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws IOException, ServletException {
        try {
            boolean write = "POST".equals(request.getMethod());
            limiter.check(write ? "public-write" : "public-read", ip.resolve(request), write ? 5 : 120,
                    write ? Duration.ofHours(1) : Duration.ofMinutes(1));
            if (write && request.getContentLengthLong() > 32768) {
                response.sendError(413, "Request is too large."); return;
            }
            chain.doFilter(request,response);
        } catch (ResponseStatusException failure) {
            response.setStatus(failure.getStatusCode().value());
            response.setHeader("Retry-After", "3600");
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Too many requests. Please wait before trying again.\"}");
        }
    }
}
