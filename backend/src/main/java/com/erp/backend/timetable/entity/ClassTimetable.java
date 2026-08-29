package com.erp.backend.timetable.entity;

import java.time.LocalDateTime;

import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.entity.ClassSection;
import com.erp.backend.curriculum.entity.SchoolClass;
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
import jakarta.persistence.Index;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "class_timetables",
        indexes = {
                @Index(name = "idx_class_timetables_identity", columnList = "institute_id,academic_session_id,class_id,section_id"),
                @Index(name = "idx_class_timetables_summary", columnList = "institute_id,academic_session_id,status")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class ClassTimetable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institute_id", nullable = false)
    private Institute institute;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "academic_session_id")
    private AcademicSession academicSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id")
    private SchoolClass schoolClass;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "section_id")
    private ClassSection section;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attendance_teacher_id")
    private Teacher attendanceTeacher;

    @Column(nullable = false)
    private String className;

    @Column(nullable = false)
    private String status = "PUBLISHED";

    private String fileName;

    @Column(columnDefinition = "TEXT")
    private String fileData;

    private String fileType;
    private LocalDateTime uploadedAt;

    @Column(columnDefinition = "TEXT")
    private String templateDataJson;

    @Column(columnDefinition = "TEXT")
    private String templateMetaJson;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
    private LocalDateTime publishedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.uploadedAt == null) {
            this.uploadedAt = now;
        }
        if (this.publishedAt == null) {
            this.publishedAt = now;
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
