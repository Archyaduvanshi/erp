package com.erp.backend.publicsite;

import com.erp.backend.auth.ClientIpResolver;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
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
        boolean write = "POST".equals(request.getMethod());
        try {
            limiter.check(write ? "public-write" : "public-read", ip.resolve(request), write ? 5 : 120,
                    write ? Duration.ofHours(1) : Duration.ofMinutes(1));
        } catch (ResponseStatusException failure) {
            response.setStatus(failure.getStatusCode().value());
            response.setHeader("Retry-After", write ? "3600" : "60");
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Too many requests. Please wait before trying again.\"}");
            return;
        }
        if (write) {
            // Bound chunked bodies too; Content-Length alone is not a reliable limit.
            if (request.getContentLengthLong() > 32768) { response.sendError(413,"Request is too large."); return; }
            byte[] body=request.getInputStream().readNBytes(32769);
            if (body.length>32768) { response.sendError(413,"Request is too large."); return; }
            chain.doFilter(new BoundedRequest(request,body),response);
        } else chain.doFilter(request,response);
    }

    private static final class BoundedRequest extends HttpServletRequestWrapper {
        private final byte[] body;
        BoundedRequest(HttpServletRequest request,byte[] body) { super(request); this.body=body; }
        @Override public int getContentLength() { return body.length; }
        @Override public long getContentLengthLong() { return body.length; }
        @Override public BufferedReader getReader() { return new BufferedReader(new InputStreamReader(getInputStream(),StandardCharsets.UTF_8)); }
        @Override public ServletInputStream getInputStream() {
            var input=new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override public int read() { return input.read(); }
                @Override public boolean isFinished() { return input.available()==0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException("Synchronous public endpoint"); }
            };
        }
    }
}
