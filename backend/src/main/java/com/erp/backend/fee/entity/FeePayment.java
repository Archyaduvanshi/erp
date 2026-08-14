package com.erp.backend.fee.entity;

import java.time.LocalDateTime;

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

    @Column(nullable = false)
    private Double paidAmount;

    private String paymentDate;
    private String coverageLabel;
    private String activeFromMonth;
    private Integer billedMonthsCount;
    private String billingType;
    private String receiptNumber;
    private String taxBreakdown;
    private Double balanceRemaining;
    private String downloadLink;

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
