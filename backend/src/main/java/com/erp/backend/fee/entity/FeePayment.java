package com.erp.backend.fee.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.institute.entity.Institute;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "fee_payments")
@Getter
@Setter
@NoArgsConstructor
public class FeePayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institute_id", nullable = false)
    private Institute institute;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "academic_session_id")
    private AcademicSession academicSession;

    @Column(nullable = false)
    private String structureId;

    @Column(nullable = false)
    private Long studentId;

    @Column(nullable = false)
    private String transactionId;

    private String gatewayRef;
    private String mode;
    private String paymentStatus;
    private String paymentTarget;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal paidAmount;

    private LocalDate paymentDate;
    private String coverageLabel;
    private String activeFromMonth;
    private Integer billedMonthsCount;
    private String billingType;
    private String receiptNumber;
    private String taxBreakdown;
    @Column(precision = 12, scale = 2)
    private BigDecimal balanceRemaining;
    private String downloadLink;
    private String idempotencyKey;
    private LocalDateTime voidedAt;
    private Long voidedByAccountId;

    @Column(length = 1000)
    private String voidReason;

    @Column(columnDefinition = "TEXT")
    private String coveredMonthsJson;

    @Column(columnDefinition = "TEXT")
    private String resolvedMonthsJson;

    @Column(columnDefinition = "TEXT")
    private String allocationsJson;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
