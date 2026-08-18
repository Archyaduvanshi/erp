package com.erp.backend.student.entity;

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
@Table(name = "students")
@Getter
@Setter
@NoArgsConstructor
public class Student {

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
    private String dob;
    private String gender;
    private String email;
    private String mobile;
    private String regDate;
    private String bloodGroup;

    @Column(length = 2000)
    private String address;

    private String city;
    private String pincode;
    private String state;

    private String guardianName;
    private String motherName;
    private String guardianPhone;

    @Column(length = 1000)
    private String prevSchool;

    private String category;
    private String admissionDate;
    private String academicYear;
    private String enrollmentNo;
    private String rollNo;
    private String className;
    private String section;
    private String assignedClass;
    private String admissionCategory;
    private String transportOptIn;
    private String hostelOptIn;
    private String libraryOptIn;
    private String transportStatus;
    private String hostelStatus;
    private String libraryStatus;
    private String libraryMonthlyCharge;
    private String studentPortalPassword;
    private String documentType;
    private String otherDocumentName;
    private String fileUploadPath;

    @Column(columnDefinition = "TEXT")
    private String documentsJson;

    @Column(length = 2000)
    private String qrCodeData;

    private String cardExpiryDate;

    @Column(columnDefinition = "TEXT")
    private String photoUrl;

    private String systemId;
    private String status;

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
