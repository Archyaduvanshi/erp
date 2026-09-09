package com.erp.backend.student.entity;

import java.time.LocalDateTime;

import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.entity.ClassSection;
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
        name = "students",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_students_institute_enrollment", columnNames = {"institute_id", "enrollment_no"}),
                @UniqueConstraint(name = "uk_students_institute_class_roll", columnNames = {"institute_id", "assigned_class", "roll_no"}),
                @UniqueConstraint(name = "uk_students_qr_code_data", columnNames = {"qr_code_data"})
        },
        indexes = {
                @Index(name = "idx_students_institute_created", columnList = "institute_id, created_at"),
                @Index(name = "idx_students_institute_class", columnList = "institute_id, assigned_class"),
                @Index(name = "idx_students_institute_class_id_status", columnList = "institute_id, class_id, status"),
                @Index(name = "idx_students_institute_status", columnList = "institute_id, status"),
                @Index(name = "idx_students_institute_class_status", columnList = "institute_id, assigned_class, status")
        }
)
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id")
    private SchoolClass schoolClass;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "section_id")
    private ClassSection classSection;

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
    private String documentType;
    private String otherDocumentName;
    private String fileUploadPath;

    @Column(columnDefinition = "TEXT")
    private String documentsJson;

    @Column(length = 80, nullable = false)
    private String qrCodeData;

    private String cardExpiryDate;

    @Column(columnDefinition = "TEXT")
    private String photoUrl;

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
