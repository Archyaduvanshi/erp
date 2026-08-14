package com.erp.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
    private static final String[] DEFAULT_ALLOWED_ORIGINS = {
            "http://localhost:5173",
            "http://localhost:3000",
            "https://erpfrontend-gilt.vercel.app"
    };

    @Value("${app.cors.allowed-origins:}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(parseOrigins())
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*");
    }

    private String[] parseOrigins() {
        return java.util.stream.Stream.concat(
                        java.util.Arrays.stream(DEFAULT_ALLOWED_ORIGINS),
                        StringUtils.hasText(allowedOrigins)
                                ? java.util.Arrays.stream(allowedOrigins.split(","))
                                : java.util.stream.Stream.empty()
                )
                .map(String::trim)
                .filter(StringUtils::hasText)
                .distinct()
                .toArray(String[]::new);
    }
}
