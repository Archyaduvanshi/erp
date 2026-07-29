package com.erp.backend.examination.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.examination.entity.ExamQuestionPaper;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExamQuestionPaperRepository extends JpaRepository<ExamQuestionPaper, Long> {
    List<ExamQuestionPaper> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<ExamQuestionPaper> findByInstituteIdAndId(Long instituteId, Long id);
}
