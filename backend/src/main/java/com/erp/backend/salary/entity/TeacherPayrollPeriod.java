package com.erp.backend.salary.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.erp.backend.curriculum.entity.AcademicSession;
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
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "teacher_payroll_periods",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_teacher_payroll_period_teacher_month",
                columnNames = {"institute_id", "teacher_id", "month_key"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class TeacherPayrollPeriod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institute_id", nullable = false)
    private Institute institute;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Teacher teacher;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "academic_session_id")
    private AcademicSession academicSession;

    @Column(nullable = false, length = 7)
    private String monthKey;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal baseSalary = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal bonusAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal leaveDeductionAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal grossAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal netPayableAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal outstandingAmount = BigDecimal.ZERO;

    private Integer openSchoolDays = 0;
    private Integer presentDays = 0;
    private Integer absentDays = 0;
    private Integer allowedLeaves = 0;
    private Integer extraLeaveDays = 0;
    private Integer paidLeaveDays = 0;
    private Integer unpaidLeaveDays = 0;
    private Integer halfDays = 0;
    private Integer missingAttendanceDays = 0;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal perDaySalary = BigDecimal.ZERO;

    @Column(nullable = false, length = 32)
    private String status = "OPEN";

    @Column(length = 2000)
    private String note;

    private LocalDateTime generatedAt;
    private Long generatedByAccountId;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
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
