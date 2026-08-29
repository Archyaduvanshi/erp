package com.erp.backend.attendance.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.erp.backend.institute.entity.Institute;
import com.erp.backend.teacher.entity.Teacher;
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
        name = "teacher_attendance_records",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_teacher_attendance_institute_teacher_date", columnNames = {"institute_id", "teacher_id", "attendance_date"})
        },
        indexes = {
                @Index(name = "idx_teacher_attendance_institute_date", columnList = "institute_id, attendance_date"),
                @Index(name = "idx_teacher_attendance_teacher_date", columnList = "teacher_id, attendance_date")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class TeacherAttendanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institute_id", nullable = false)
    private Institute institute;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Teacher teacher;

    @Column(nullable = false)
    private LocalDate attendanceDate;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private String markedBy;

    @Column(name = "marked_by_user_id")
    private Long markedByUserId;

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
