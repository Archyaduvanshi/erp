package com.erp.backend.notice.entity;

import java.time.LocalDate;
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
@Table(name = "notices")
@Getter
@Setter
@NoArgsConstructor
public class Notice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institute_id", nullable = false)
    private Institute institute;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private String audience;

    @Column(length = 2000)
    private String targetClasses;

    private Long targetStudentId;

    @Column(nullable = false)
    private String priority;

    @Column(nullable = false)
    private LocalDate publishDate;

    private LocalDate expireDate;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private Boolean pinned = false;

    @Column(length = 1000, nullable = false)
    private String summary;

    @Column(length = 5000, nullable = false)
    private String details;

    private String sourceType;
    private Long sourceId;

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
