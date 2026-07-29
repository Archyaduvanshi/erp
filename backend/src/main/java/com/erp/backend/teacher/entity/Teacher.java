package com.erp.backend.teacher.entity;

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
@Table(name = "teachers")
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
    private String specialization;
    private String experienceYears;
    private String contractType;
    private String leaveBalance;
    private String salary;
    private String dob;
    private String joiningDate;
    private String teacherPortalPassword;
    private String documentType;
    private String otherDocumentName;
    private String fileUploadPath;

    @Column(columnDefinition = "TEXT")
    private String documentsJson;

    @Column(columnDefinition = "TEXT")
    private String paymentHistoryJson;

    @Column(columnDefinition = "TEXT")
    private String qrCodeData;

    private String cardExpiryDate;

    @Column(columnDefinition = "TEXT")
    private String photoUrl;

    private String teacherSystemId;
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
