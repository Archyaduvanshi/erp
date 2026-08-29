package com.erp.backend.examination.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.entity.ClassSection;
import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.entity.Subject;
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
        name = "exam_schedules",
        indexes = {
                @Index(name = "idx_exam_schedules_exam_class", columnList = "institute_id,academic_session_id,exam_id,class_id"),
                @Index(name = "idx_exam_schedules_subject", columnList = "exam_id,class_id,subject_id")
        },
        uniqueConstraints = @UniqueConstraint(
                name = "uk_exam_schedules_slot",
                columnNames = {"institute_id", "academic_session_id", "exam_id", "class_id", "section_id", "subject_id", "exam_date", "shift_number"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class ExamSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institute_id", nullable = false)
    private Institute institute;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "academic_session_id", nullable = false)
    private AcademicSession academicSession;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_id", nullable = false)
    private SchoolClass schoolClass;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "section_id")
    private ClassSection section;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id")
    private Subject subject;

    private LocalDate examDate;
    private Integer shiftNumber;
    private LocalTime startTime;
    private Integer durationMinutes;
    private String roomOrCenter;
    private BigDecimal maxMarks;

    @Column(nullable = false)
    private String status = "PUBLISHED";

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
