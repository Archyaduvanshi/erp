package com.erp.backend.auth;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    private static final List<String> BUILT_IN_TRUSTED_ORIGINS = List.of(
            "https://erpfrontend-kohl.vercel.app"
    );

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, AuthSecurityFilter authSecurityFilter) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .cors(cors -> {})
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, authException) -> response.sendError(HttpStatus.UNAUTHORIZED.value(), "Authentication required."))
                )
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(authSecurityFilter, UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/health").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/email/send", "/api/auth/email/verify").permitAll()
                        .requestMatchers("/api/auth/refresh", "/api/auth/logout", "/api/auth/password/forgot", "/api/auth/password/reset").permitAll()
                        .requestMatchers("/api/settings/login").permitAll()
                        .requestMatchers("/api/platform/auth/login", "/api/platform/auth/refresh", "/api/platform/auth/logout").permitAll()
                        .requestMatchers("/api/institutes/login").permitAll()
                        .requestMatchers("/api/uploads/registration-logo").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/cashfree/webhook").permitAll()
                        .anyRequest().authenticated()
                );
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins:}") String allowedOrigins,
            @Value("${app.cors.allowed-origin-patterns:}") String allowedOriginPatterns
    ) {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = parseCorsValues(allowedOrigins, BUILT_IN_TRUSTED_ORIGINS);
        if (!origins.isEmpty()) {
            configuration.setAllowedOrigins(origins);
        }
        List<String> patterns = parseCorsValues(allowedOriginPatterns, List.of());
        if (!patterns.isEmpty()) {
            configuration.setAllowedOriginPatterns(patterns);
        }
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setExposedHeaders(Arrays.asList("X-Access-Token"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private List<String> parseCorsValues(String configuredValues, List<String> builtInValues) {
        Set<String> values = new LinkedHashSet<>(builtInValues);
        if (configuredValues != null && !configuredValues.isBlank()) {
            Arrays.stream(configuredValues.split(","))
                    .map(this::normalizeCorsValue)
                    .filter(value -> !value.isBlank())
                    .forEach(values::add);
        }
        return List.copyOf(values);
    }

    private String normalizeCorsValue(String value) {
        String normalized = value == null ? "" : value.trim();
        if ((normalized.startsWith("\"") && normalized.endsWith("\""))
                || (normalized.startsWith("'") && normalized.endsWith("'"))) {
            normalized = normalized.substring(1, normalized.length() - 1).trim();
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }
}
