package com.erp.backend.timetable.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.timetable.entity.TimetableTemplateDraft;
import com.erp.backend.timetable.dto.DraftRecordSummary;
import com.erp.backend.timetable.dto.TimetableRecordSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TimetableTemplateDraftRepository extends JpaRepository<TimetableTemplateDraft, Long> {
    List<TimetableTemplateDraft> findAllByInstituteIdOrderByClassNameAsc(Long instituteId);

    Optional<TimetableTemplateDraft> findByInstituteIdAndId(Long instituteId, Long id);

    List<TimetableTemplateDraft> findAllByInstituteIdAndAcademicSessionId(Long instituteId, Long academicSessionId);

    @Query("""
            select new com.erp.backend.timetable.dto.DraftRecordSummary(
                d.id,
                d.academicSession.id,
                d.schoolClass.id,
                d.section.id,
                d.updatedAt
            )
            from TimetableTemplateDraft d
            where d.institute.id = :instituteId
              and d.academicSession.id = :academicSessionId
              and d.schoolClass is not null
            """)
    List<DraftRecordSummary> findRecordSummaries(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId
    );

    Optional<TimetableTemplateDraft> findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSectionId(
            Long instituteId,
            Long academicSessionId,
            Long schoolClassId,
            Long sectionId
    );

    Optional<TimetableTemplateDraft> findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSectionIsNull(
            Long instituteId,
            Long academicSessionId,
            Long schoolClassId
    );

    @Query("""
            select d
            from TimetableTemplateDraft d
            where d.institute.id = :instituteId
              and d.academicSession.id = :academicSessionId
              and d.schoolClass.id = :classId
              and (:sectionId is null and d.section is null or d.section.id = :sectionId)
            """)
    Optional<TimetableTemplateDraft> findStructured(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("classId") Long classId,
            @Param("sectionId") Long sectionId
    );

    @Query("""
            select new com.erp.backend.timetable.dto.TimetableRecordSummary(
                d.id,
                d.academicSession.id,
                d.schoolClass.id,
                d.section.id,
                d.updatedAt,
                'DRAFT'
            )
            from TimetableTemplateDraft d
            where d.institute.id = :instituteId
            """)
    List<TimetableRecordSummary> findSummaries(@Param("instituteId") Long instituteId);
}
