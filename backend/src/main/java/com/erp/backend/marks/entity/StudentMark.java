package com.erp.backend.marks.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.erp.backend.institute.entity.Institute;
import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.entity.Subject;
import com.erp.backend.student.entity.Student;
import jakarta.persistence.Index;
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
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "student_marks",
        indexes = {
                @Index(name = "idx_student_marks_session_class_exam", columnList = "institute_id,academic_session_id,class_id,exam_id"),
                @Index(name = "idx_student_marks_session_student_exam", columnList = "institute_id,academic_session_id,student_id,exam_id"),
                @Index(name = "idx_student_marks_session_subject_exam", columnList = "institute_id,academic_session_id,subject_id,exam_id"),
                @Index(name = "idx_student_marks_register_student", columnList = "marks_register_id,student_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class StudentMark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institute_id", nullable = false)
    private Institute institute;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "academic_session_id")
    private AcademicSession academicSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id")
    private SchoolClass schoolClass;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id")
    private Subject subject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id")
    private ExamDefinition exam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "marks_register_id")
    private MarksRegister marksRegister;

    @Column(nullable = false)
    private String className;

    @Column(nullable = false)
    private String subjectName;

    @Column(nullable = false)
    private String examTitle;

    private LocalDate examDate;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal maxMarks;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal marksObtained;

    private String rollNo;

    private String uploadedBy;
    private String status = "PRESENT";
    private String remarks;
    private Long enteredByAccountId;
    private Long updatedByAccountId;

    @Version
    private Long version;

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
