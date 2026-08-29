package com.erp.backend.auth;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class ClientIpResolver {
    private final Set<String> trustedProxyAddresses;

    public ClientIpResolver(@Value("${app.auth.trusted-proxy-addresses:}") String trustedProxyAddresses) {
        this.trustedProxyAddresses = Arrays.stream(trustedProxyAddresses.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .collect(Collectors.toUnmodifiableSet());
    }

    public String resolve(HttpServletRequest request) {
        String remoteAddress = request.getRemoteAddr();
        if (!trustedProxyAddresses.contains(remoteAddress)) {
            return remoteAddress;
        }
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (!StringUtils.hasText(forwardedFor)) {
            return remoteAddress;
        }
        return forwardedFor.split(",")[0].trim();
    }
}
