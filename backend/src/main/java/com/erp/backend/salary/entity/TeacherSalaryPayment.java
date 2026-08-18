package com.erp.backend.salary.entity;

import java.math.BigDecimal;
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

    @Column(nullable = false)
    private String monthKey;

    @Column(nullable = false)
    private BigDecimal baseSalary = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal previousPendingAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal bonusAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal leaveDeductionAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    private Integer openSchoolDays = 0;
    private Integer presentDays = 0;
    private Integer absentDays = 0;
    private Integer allowedLeaves = 0;
    private Integer extraLeaveDays = 0;

    @Column(nullable = false)
    private BigDecimal perDaySalary = BigDecimal.ZERO;

    private String paidOn;

    @Column(length = 2000)
    private String settledMonthKeys;

    @Column(length = 2000)
    private String note;

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
