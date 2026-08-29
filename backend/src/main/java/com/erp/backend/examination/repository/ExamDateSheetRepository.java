package com.erp.backend.examination.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.examination.entity.ExamDateSheet;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExamDateSheetRepository extends JpaRepository<ExamDateSheet, Long> {
    List<ExamDateSheet> findAllByInstituteIdOrderByClassNameAsc(Long instituteId);

    Optional<ExamDateSheet> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<ExamDateSheet> findByInstituteIdAndClassNameIgnoreCase(Long instituteId, String className);

    long countByInstituteIdAndAcademicSessionIdAndStatusIgnoreCase(Long instituteId, Long academicSessionId, String status);

    @Query("""
            select d
            from ExamDateSheet d
            where d.institute.id = :instituteId
              and (:academicSessionId is null or (d.academicSession is not null and d.academicSession.id = :academicSessionId))
              and (:examId is null or (d.exam is not null and d.exam.id = :examId))
              and (:classId is null or (d.schoolClass is not null and d.schoolClass.id = :classId))
              and (:status = '' or upper(coalesce(d.status, 'PUBLISHED')) = upper(:status))
              and upper(coalesce(d.status, 'PUBLISHED')) <> 'ARCHIVED'
              and (:search = '' or lower(concat(coalesce(d.examType, ''), ' ', coalesce(d.className, ''), ' ', coalesce(d.fileName, ''))) like lower(concat('%', :search, '%')))
            order by d.createdAt desc
            """)
    Page<ExamDateSheet> findDateSheets(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("examId") Long examId,
            @Param("classId") Long classId,
            @Param("status") String status,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("""
            select d
            from ExamDateSheet d
            where d.institute.id = :instituteId
              and upper(coalesce(d.status, 'PUBLISHED')) = 'PUBLISHED'
              and (:academicSessionId is null or d.academicSession is null or d.academicSession.id = :academicSessionId)
              and (
                (d.schoolClass is not null and d.schoolClass.id = :classId)
                or lower(coalesce(d.className, '')) = lower(:className)
                or lower(coalesce(d.className, '')) = lower(:baseClassName)
                or d.classFrom is not null
              )
            order by d.createdAt desc
            """)
    List<ExamDateSheet> findStudentVisibleCandidates(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("classId") Long classId,
            @Param("className") String className,
            @Param("baseClassName") String baseClassName
    );

    @Query("""
            select distinct d
            from ExamDateSheet d
            join ExamSchedule s
              on s.institute.id = d.institute.id
             and s.academicSession.id = d.academicSession.id
             and s.exam.id = d.exam.id
            where d.institute.id = :instituteId
              and d.academicSession.id = :academicSessionId
              and upper(coalesce(d.status, 'PUBLISHED')) = 'PUBLISHED'
              and upper(coalesce(s.status, 'PUBLISHED')) = 'PUBLISHED'
              and s.schoolClass.id = :classId
              and (s.section is null or (:sectionId is not null and s.section.id = :sectionId))
            order by d.createdAt desc
            """)
    List<ExamDateSheet> findPublishedForStudentSchedule(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("classId") Long classId,
            @Param("sectionId") Long sectionId
    );

    @Query("""
            select distinct d
            from ExamDateSheet d
            join ExamSchedule s
              on s.institute.id = d.institute.id
             and s.academicSession.id = d.academicSession.id
             and s.exam.id = d.exam.id
            where d.institute.id = :instituteId
              and d.academicSession.id = :academicSessionId
              and upper(coalesce(d.status, 'PUBLISHED')) = 'PUBLISHED'
              and exists (
                select 1
                from TimetablePeriod p
                join p.timetable t
                join p.classSubject cs
                where t.institute.id = d.institute.id
                  and t.academicSession.id = d.academicSession.id
                  and t.status = 'PUBLISHED'
                  and p.teacher.id = :teacherId
                  and cs.schoolClass.id = s.schoolClass.id
              )
            order by d.createdAt desc
            """)
    List<ExamDateSheet> findPublishedForTeacherAssignments(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("teacherId") Long teacherId
    );
}
