package com.erp.backend.cashfree.repository;

import java.util.Optional;

import com.erp.backend.cashfree.entity.CashfreeWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CashfreeWebhookEventRepository extends JpaRepository<CashfreeWebhookEvent, Long> {
    boolean existsByEventKey(String eventKey);
    Optional<CashfreeWebhookEvent> findByEventKey(String eventKey);

    @Modifying
    @Query(value = """
            insert into cashfree_webhook_events
                (event_key, event_type, merchant_id, order_id, cf_payment_id, payload_hash, status, received_at)
            values
                (:eventKey, :eventType, :merchantId, :orderId, :cfPaymentId, :payloadHash, 'RECEIVED', now())
            on conflict (event_key) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(
            @Param("eventKey") String eventKey,
            @Param("eventType") String eventType,
            @Param("merchantId") String merchantId,
            @Param("orderId") String orderId,
            @Param("cfPaymentId") String cfPaymentId,
            @Param("payloadHash") String payloadHash
    );
}
