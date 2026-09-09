package com.erp.backend.teacher.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.erp.backend.institute.entity.Institute;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
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
        name = "teachers",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_teachers_institute_employee", columnNames = {"institute_id", "employee_id"}),
                @UniqueConstraint(name = "uk_teachers_institute_email", columnNames = {"institute_id", "personal_email"}),
                @UniqueConstraint(name = "uk_teachers_institute_mobile", columnNames = {"institute_id", "mobile_number"}),
                @UniqueConstraint(name = "uk_teachers_qr_code_data", columnNames = {"qr_code_data"})
        },
        indexes = {
                @Index(name = "idx_teachers_institute_created", columnList = "institute_id, created_at"),
                @Index(name = "idx_teachers_institute_status", columnList = "institute_id, status"),
                @Index(name = "idx_teachers_institute_contract", columnList = "institute_id, contract_type"),
                @Index(name = "idx_teachers_institute_specialization", columnList = "institute_id, specialization")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class Teacher {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institute_id", nullable = false)
    private Institute institute;

    @Column(nullable = false)
    private String firstName;

    @Column(name = "name", nullable = false)
    private String name;

    private String lastName;
    private String personalEmail;
    private String mobileNumber;
    private String employeeId;
    private String address;
    private String city;
    private String state;
    private String pincode;
    private String specialization;
    private String experienceYears;
    private String contractType;
    private String leaveBalance;
    private String salary;

    @Column(precision = 12, scale = 2)
    private BigDecimal salaryAmount;
    private String dob;
    private String joiningDate;
    private String documentType;
    private String otherDocumentName;
    private String fileUploadPath;

    @Column(columnDefinition = "TEXT")
    private String documentsJson;

    @Column(columnDefinition = "TEXT")
    private String paymentHistoryJson;

    @Column(length = 80, nullable = false)
    private String qrCodeData;

    private String cardExpiryDate;

    @Column(columnDefinition = "TEXT")
    private String photoUrl;

    private String status;
    private String attendanceStatus;

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
