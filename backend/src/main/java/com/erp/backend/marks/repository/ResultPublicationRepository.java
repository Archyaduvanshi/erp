package com.erp.backend.marks.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.marks.entity.ResultPublication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ResultPublicationRepository extends JpaRepository<ResultPublication, Long> {

    Optional<ResultPublication> findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndExamId(
            Long instituteId,
            Long academicSessionId,
            Long classId,
            Long examId
    );

    boolean existsByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndExamIdAndStatusIgnoreCase(
            Long instituteId,
            Long academicSessionId,
            Long classId,
            Long examId,
            String status
    );

    @Query("""
            select p.exam.id
            from ResultPublication p
            where p.institute.id = :instituteId
              and p.academicSession.id = :academicSessionId
              and p.schoolClass.id = :classId
              and upper(p.status) = 'PUBLISHED'
            """)
    List<Long> findPublishedExamIds(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("classId") Long classId
    );
}
