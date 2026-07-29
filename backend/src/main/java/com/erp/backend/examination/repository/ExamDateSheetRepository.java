package com.erp.backend.examination.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.examination.entity.ExamDateSheet;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExamDateSheetRepository extends JpaRepository<ExamDateSheet, Long> {
    List<ExamDateSheet> findAllByInstituteIdOrderByClassNameAsc(Long instituteId);

    Optional<ExamDateSheet> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<ExamDateSheet> findByInstituteIdAndClassNameIgnoreCase(Long instituteId, String className);
}
