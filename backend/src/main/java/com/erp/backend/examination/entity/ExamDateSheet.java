package com.erp.backend.examination.entity;

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
@Table(name = "exam_date_sheets")
@Getter
@Setter
@NoArgsConstructor
public class ExamDateSheet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institute_id", nullable = false)
    private Institute institute;

    @Column(nullable = false)
    private String className;

    private String classFrom;
    private String classTo;
    private Boolean sectionWise;
    private String examType;
    private String shiftsPerDay;

    @Column(columnDefinition = "TEXT")
    private String shiftStartTimesJson;

    private String shiftDurationHours;
    private String shiftDurationUnit;
    private String examStartDate;
    private String examEndDate;
    private String fileName;

    @Column(columnDefinition = "TEXT")
    private String fileData;

    private String fileType;

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
