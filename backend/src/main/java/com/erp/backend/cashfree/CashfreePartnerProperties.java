package com.erp.backend.cashfree;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class CashfreePartnerProperties {
    private final boolean enabled;
    private final String environment;
    private final String partnerApiKey;
    private final String partnerBaseUrl;
    private final String paymentBaseUrl;
    private final String partnerApiVersion;
    private final String paymentApiVersion;
    private final String frontendBaseUrl;
    private final String merchantSiteUrl;
    private final String webhookUrl;

    public CashfreePartnerProperties(
            @Value("${app.cashfree.enabled:false}") boolean enabled,
            @Value("${app.cashfree.environment:sandbox}") String environment,
            @Value("${app.cashfree.partner-api-key:}") String partnerApiKey,
            @Value("${app.cashfree.partner-base-url:https://api-sandbox.cashfree.com/partners}") String partnerBaseUrl,
            @Value("${app.cashfree.payment-base-url:https://sandbox.cashfree.com/pg}") String paymentBaseUrl,
            @Value("${app.cashfree.partner-api-version:2023-01-01}") String partnerApiVersion,
            @Value("${app.cashfree.payment-api-version:2025-01-01}") String paymentApiVersion,
            @Value("${app.cashfree.frontend-base-url:http://localhost:5173}") String frontendBaseUrl,
            @Value("${app.cashfree.merchant-site-url:https://erpfrontend-kohl.vercel.app}") String merchantSiteUrl,
            @Value("${app.cashfree.webhook-url:http://localhost:8080/api/cashfree/webhook}") String webhookUrl
    ) {
        this.enabled = enabled;
        this.environment = environment;
        this.partnerApiKey = partnerApiKey;
        this.partnerBaseUrl = stripTrailingSlash(partnerBaseUrl);
        this.paymentBaseUrl = stripTrailingSlash(paymentBaseUrl);
        this.partnerApiVersion = partnerApiVersion;
        this.paymentApiVersion = paymentApiVersion;
        this.frontendBaseUrl = stripTrailingSlash(frontendBaseUrl);
        this.merchantSiteUrl = stripTrailingSlash(merchantSiteUrl);
        this.webhookUrl = webhookUrl;
    }

    public boolean enabled() { return enabled; }
    public String environment() { return environment; }
    public String partnerApiKey() { return partnerApiKey; }
    public String partnerBaseUrl() { return partnerBaseUrl; }
    public String paymentBaseUrl() { return paymentBaseUrl; }
    public String partnerApiVersion() { return partnerApiVersion; }
    public String paymentApiVersion() { return paymentApiVersion; }
    public String frontendBaseUrl() { return frontendBaseUrl; }
    public String merchantSiteUrl() { return merchantSiteUrl; }
    public String webhookUrl() { return webhookUrl; }

    public void requireConfigured() {
        if (!enabled || partnerApiKey == null || partnerApiKey.isBlank()) {
            throw new IllegalArgumentException("CASHFREE_NOT_CONFIGURED: Online payments are not configured yet.");
        }
    }

    private static String stripTrailingSlash(String value) {
        String result = value == null ? "" : value.trim();
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
        return result;
    }
}
