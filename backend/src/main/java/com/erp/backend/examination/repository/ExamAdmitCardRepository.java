package com.erp.backend.examination.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.examination.entity.ExamAdmitCard;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExamAdmitCardRepository extends JpaRepository<ExamAdmitCard, Long> {
    List<ExamAdmitCard> findAllByInstituteIdOrderByExamDateAscCreatedAtDesc(Long instituteId);

    Optional<ExamAdmitCard> findByInstituteIdAndId(Long instituteId, Long id);
}
