package com.erp.backend.cashbook.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.institute.entity.Institute;
import com.fasterxml.jackson.annotation.JsonIgnore;
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
@Table(name = "cashbook_entries")
@Getter
@Setter
@NoArgsConstructor
public class CashbookEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institute_id", nullable = false)
    @JsonIgnore
    private Institute institute;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "academic_session_id")
    @JsonIgnore
    private AcademicSession academicSession;

    @Column(nullable = false)
    private LocalDate transactionDate;

    @Column(nullable = false, length = 32)
    private String entryType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    @JsonIgnore
    private FinancialCategory category;

    @Column(nullable = false, length = 80)
    private String categoryCode;

    @Column(nullable = false, length = 160)
    private String categoryLabel;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    @JsonIgnore
    private FinancialAccount account;

    @Column(nullable = false, length = 40)
    private String paymentMode = "Cash";

    @Column(length = 220)
    private String payerPayeeName;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false, length = 40)
    private String sourceType;

    private Long sourceId;

    @Column(nullable = false, length = 40)
    private String voucherNumber;

    @Column(length = 160)
    private String referenceNumber;

    @Column(nullable = false, length = 32)
    private String status = "POSTED";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reversal_of_entry_id")
    @JsonIgnore
    private CashbookEntry reversalOfEntry;

    @Column(length = 80)
    private String transferReferenceId;

    @Column(length = 1000)
    private String attachmentUrl;

    @Column(length = 255)
    private String attachmentName;

    @Column(length = 120)
    private String attachmentContentType;

    @Column(length = 120)
    private String idempotencyKey;

    private Long createdByAccountId;
    private Long voidedByAccountId;
    private LocalDateTime voidedAt;

    @Column(length = 1000)
    private String voidReason;

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
