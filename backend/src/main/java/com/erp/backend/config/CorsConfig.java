package com.erp.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Value("${app.cors.allowed-origins:}")
    private String allowedOrigins;

    @Value("${app.cors.allowed-origin-patterns:}")
    private String allowedOriginPatterns;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(parseOrigins())
                .allowedOriginPatterns(parsePatterns())
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("Authorization", "Content-Type", "Accept")
                .exposedHeaders("X-Access-Token")
                .allowCredentials(true);
    }

    private String[] parseOrigins() {
        return StringUtils.hasText(allowedOrigins)
                ? java.util.Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .distinct()
                .toArray(String[]::new)
                : new String[0];
    }

    private String[] parsePatterns() {
        return StringUtils.hasText(allowedOriginPatterns)
                ? java.util.Arrays.stream(allowedOriginPatterns.split(","))
                        .map(String::trim)
                        .filter(StringUtils::hasText)
                        .distinct()
                        .toArray(String[]::new)
                : new String[0];
    }
}
