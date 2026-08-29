package com.erp.backend.examination.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.examination.entity.Exam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExamRepository extends JpaRepository<Exam, Long> {

    Optional<Exam> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<Exam> findByInstituteIdAndAcademicSessionIdAndNormalizedNameAndExamTypeAndStartDate(
            Long instituteId,
            Long academicSessionId,
            String normalizedName,
            String examType,
            java.time.LocalDate startDate
    );

    List<Exam> findAllByInstituteIdAndAcademicSessionIdOrderByStartDateAscNameAsc(Long instituteId, Long academicSessionId);

    @Query("""
            select count(e)
            from Exam e
            where e.institute.id = :instituteId
              and e.academicSession.id = :academicSessionId
              and upper(coalesce(e.status, 'SCHEDULED')) <> 'ARCHIVED'
            """)
    long countActiveBySession(@Param("instituteId") Long instituteId, @Param("academicSessionId") Long academicSessionId);

    @Query("""
            select count(e)
            from Exam e
            where e.institute.id = :instituteId
              and e.academicSession.id = :academicSessionId
              and e.startDate >= CURRENT_DATE
              and upper(coalesce(e.status, 'SCHEDULED')) <> 'ARCHIVED'
            """)
    long countUpcoming(@Param("instituteId") Long instituteId, @Param("academicSessionId") Long academicSessionId);

    @Query("""
            select min(e.startDate)
            from Exam e
            where e.institute.id = :instituteId
              and e.academicSession.id = :academicSessionId
              and e.startDate >= CURRENT_DATE
              and upper(coalesce(e.status, 'SCHEDULED')) <> 'ARCHIVED'
            """)
    java.time.LocalDate findNextExamDate(@Param("instituteId") Long instituteId, @Param("academicSessionId") Long academicSessionId);
}
