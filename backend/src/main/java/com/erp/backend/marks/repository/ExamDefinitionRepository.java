package com.erp.backend.marks.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.erp.backend.marks.entity.ExamDefinition;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExamDefinitionRepository extends JpaRepository<ExamDefinition, Long> {

    Optional<ExamDefinition> findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndNormalizedTitleAndExamDate(
            Long instituteId,
            Long academicSessionId,
            Long classId,
            String normalizedTitle,
            LocalDate examDate
    );

    Optional<ExamDefinition> findByInstituteIdAndId(Long instituteId, Long id);

    List<ExamDefinition> findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdOrderByExamDateAscTitleAsc(
            Long instituteId,
            Long academicSessionId,
            Long classId
    );

    List<ExamDefinition> findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndIdInOrderByExamDateAscTitleAsc(
            Long instituteId,
            Long academicSessionId,
            Long classId,
            java.util.Collection<Long> examIds
    );
}
