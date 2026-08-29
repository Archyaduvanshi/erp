package com.erp.backend.notice.entity;

import com.erp.backend.curriculum.entity.SchoolClass;
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
        name = "notice_target_classes",
        uniqueConstraints = @UniqueConstraint(name = "uk_notice_target_classes_notice_class", columnNames = {"notice_id", "class_id"}),
        indexes = {
                @Index(name = "idx_notice_target_classes_notice", columnList = "notice_id"),
                @Index(name = "idx_notice_target_classes_class_notice", columnList = "class_id,notice_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class NoticeTargetClass {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "notice_id", nullable = false)
    private Notice notice;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_id", nullable = false)
    private SchoolClass schoolClass;
}
