package com.erp.backend.marks.entity;

import java.time.LocalDateTime;

import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.entity.SchoolClass;
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
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "result_publications",
        indexes = @Index(name = "idx_result_publications_session_class_exam", columnList = "institute_id,academic_session_id,class_id,exam_id"),
        uniqueConstraints = @UniqueConstraint(
                name = "uk_result_publications_institute_session_class_exam",
                columnNames = {"institute_id", "academic_session_id", "class_id", "exam_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class ResultPublication {

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
    @JoinColumn(name = "class_id", nullable = false)
    private SchoolClass schoolClass;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private ExamDefinition exam;

    @Column(nullable = false)
    private String status = "DRAFT";

    private Long publishedByAccountId;
    private LocalDateTime publishedAt;
    private Long reopenedByAccountId;
    private LocalDateTime reopenedAt;
    @Column(length = 1000)
    private String reopenReason;
    private LocalDateTime lockedAt;
}
