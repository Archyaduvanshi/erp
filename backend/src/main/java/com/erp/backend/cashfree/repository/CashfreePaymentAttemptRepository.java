package com.erp.backend.cashfree.repository;

import java.util.Optional;

import com.erp.backend.cashfree.entity.CashfreePaymentAttempt;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CashfreePaymentAttemptRepository extends JpaRepository<CashfreePaymentAttempt, Long> {
    Optional<CashfreePaymentAttempt> findByInstituteIdAndStudentIdAndIdempotencyKey(Long instituteId, Long studentId, String idempotencyKey);
    Optional<CashfreePaymentAttempt> findByInstituteIdAndStudentIdAndOrderId(Long instituteId, Long studentId, String orderId);
    Page<CashfreePaymentAttempt> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from CashfreePaymentAttempt a join fetch a.merchantAccount where a.orderId = :orderId")
    Optional<CashfreePaymentAttempt> findByOrderIdForUpdate(@Param("orderId") String orderId);
}
