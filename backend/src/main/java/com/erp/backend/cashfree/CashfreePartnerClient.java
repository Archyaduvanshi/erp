package com.erp.backend.cashfree;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class CashfreePartnerClient {
    private final CashfreePartnerProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    public CashfreePartnerClient(CashfreePartnerProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public JsonNode createMerchant(JsonNode body) {
        return send("POST", properties.partnerBaseUrl() + "/merchants", body, null, null, properties.partnerApiVersion());
    }

    public JsonNode getMerchant(String merchantId) {
        return send("GET", properties.partnerBaseUrl() + "/merchants/" + encode(merchantId), null, null, null, properties.partnerApiVersion());
    }

    public JsonNode createOnboardingLink(String merchantId, JsonNode body) {
        return send("POST", properties.partnerBaseUrl() + "/merchants/" + encode(merchantId) + "/onboarding_link", body, null, null, properties.partnerApiVersion());
    }

    public JsonNode createOrder(String merchantId, String idempotencyKey, JsonNode body) {
        return send("POST", properties.paymentBaseUrl() + "/orders", body, merchantId, idempotencyKey, properties.paymentApiVersion());
    }

    public JsonNode getOrder(String merchantId, String orderId) {
        return send("GET", properties.paymentBaseUrl() + "/orders/" + encode(orderId), null, merchantId, null, properties.paymentApiVersion());
    }

    public JsonNode getOrderPayments(String merchantId, String orderId) {
        return send("GET", properties.paymentBaseUrl() + "/orders/" + encode(orderId) + "/payments", null, merchantId, null, properties.paymentApiVersion());
    }

    private JsonNode send(String method, String url, JsonNode body, String merchantId, String idempotencyKey, String apiVersion) {
        properties.requireConfigured();
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .header("x-api-version", apiVersion)
                .header("x-partner-apikey", properties.partnerApiKey());
        if (merchantId != null && !merchantId.isBlank()) builder.header("x-partner-merchantid", merchantId);
        if (idempotencyKey != null && !idempotencyKey.isBlank()) builder.header("x-idempotency-key", idempotencyKey);
        builder.method(method, body == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body.toString()));
        try {
            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            JsonNode responseBody = response.body() == null || response.body().isBlank()
                    ? objectMapper.createObjectNode()
                    : objectMapper.readTree(response.body());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String message = responseBody.path("message").asText("Cashfree rejected the request.");
                throw new IllegalArgumentException("CASHFREE_API_ERROR: " + message);
            }
            return responseBody;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalArgumentException("CASHFREE_UNAVAILABLE: Payment service request was interrupted.");
        } catch (IOException exception) {
            throw new IllegalArgumentException("CASHFREE_UNAVAILABLE: Unable to contact payment service.");
        }
    }

    private String encode(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
    }
}
