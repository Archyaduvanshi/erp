package com.erp.backend.salary.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.erp.backend.institute.entity.Institute;
import com.erp.backend.teacher.entity.Teacher;
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
@Table(name = "teacher_salary_payments")
@Getter
@Setter
@NoArgsConstructor
public class TeacherSalaryPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institute_id", nullable = false)
    private Institute institute;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Teacher teacher;

    @Column(length = 40)
    private String paymentReference;

    @Column(nullable = false)
    private String monthKey;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal baseSalary = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal previousPendingAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal bonusAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal leaveDeductionAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    private Integer openSchoolDays = 0;
    private Integer presentDays = 0;
    private Integer absentDays = 0;
    private Integer allowedLeaves = 0;
    private Integer extraLeaveDays = 0;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal perDaySalary = BigDecimal.ZERO;

    private LocalDate paidOn;

    @Column(nullable = false, length = 32)
    private String status = "COMPLETED";

    @Column(length = 120)
    private String idempotencyKey;

    @Column(length = 60)
    private String paymentMode;

    @Column(length = 120)
    private String transactionReference;

    @Column(length = 2000)
    private String settledMonthKeys;

    @Column(length = 2000)
    private String note;

    private Long createdByAccountId;
    private Long voidedByAccountId;
    private LocalDateTime voidedAt;

    @Column(length = 2000)
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
