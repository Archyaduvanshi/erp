package com.erp.backend.examination.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.examination.entity.ExamQuestionPaper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExamQuestionPaperRepository extends JpaRepository<ExamQuestionPaper, Long> {
    List<ExamQuestionPaper> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<ExamQuestionPaper> findByInstituteIdAndId(Long instituteId, Long id);

    @Query("""
            select count(q)
            from ExamQuestionPaper q
            where q.institute.id = :instituteId
              and q.academicSession.id = :academicSessionId
              and upper(coalesce(q.status, 'DRAFT')) <> 'ARCHIVED'
            """)
    long countActiveBySession(@Param("instituteId") Long instituteId, @Param("academicSessionId") Long academicSessionId);

    Optional<ExamQuestionPaper> findByInstituteIdAndAcademicSessionIdAndExamIdAndSchoolClassIdAndSubjectId(
            Long instituteId,
            Long academicSessionId,
            Long examId,
            Long schoolClassId,
            Long subjectId
    );

    @Query("""
            select q
            from ExamQuestionPaper q
            where q.institute.id = :instituteId
              and (:academicSessionId is null or (q.academicSession is not null and q.academicSession.id = :academicSessionId))
              and (:examId is null or (q.exam is not null and q.exam.id = :examId))
              and (:classId is null or (q.schoolClass is not null and q.schoolClass.id = :classId))
              and (:subjectId is null or (q.subject is not null and q.subject.id = :subjectId))
              and (:status = '' or upper(coalesce(q.status, 'DRAFT')) = upper(:status))
              and upper(coalesce(q.status, 'DRAFT')) <> 'ARCHIVED'
              and (:search = '' or lower(concat(coalesce(q.examTitle, ''), ' ', coalesce(q.className, ''), ' ', coalesce(q.subjectName, ''), ' ', coalesce(q.fileName, ''))) like lower(concat('%', :search, '%')))
            order by q.createdAt desc
            """)
    Page<ExamQuestionPaper> findQuestionPapers(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("examId") Long examId,
            @Param("classId") Long classId,
            @Param("subjectId") Long subjectId,
            @Param("status") String status,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("""
            select q
            from ExamQuestionPaper q
            where q.institute.id = :instituteId
              and upper(coalesce(q.status, 'DRAFT')) = 'RELEASED'
              and (q.releaseAt is null or q.releaseAt <= CURRENT_TIMESTAMP)
              and (:academicSessionId is null or q.academicSession is null or q.academicSession.id = :academicSessionId)
              and upper(coalesce(q.status, 'DRAFT')) <> 'ARCHIVED'
              and (
                (q.schoolClass is not null and q.schoolClass.id = :classId)
                or lower(coalesce(q.className, '')) = lower(:className)
              )
            order by q.examTitle asc, q.subjectName asc
            """)
    List<ExamQuestionPaper> findReleasedForStudentClass(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("classId") Long classId,
            @Param("className") String className
    );

    @Query("""
            select q
            from ExamQuestionPaper q
            where q.institute.id = :instituteId
              and (:academicSessionId is null or q.academicSession is null or q.academicSession.id = :academicSessionId)
              and (
                (q.uploadedByTeacher is not null and q.uploadedByTeacher.id = :teacherId)
                or exists (
                    select 1
                    from TimetablePeriod p
                    join p.timetable t
                    join p.classSubject cs
                    join cs.subject sub
                    where t.institute.id = q.institute.id
                      and t.status = 'PUBLISHED'
                      and p.teacher.id = :teacherId
                      and lower(t.className) = lower(q.className)
                      and lower(sub.name) = lower(q.subjectName)
                )
              )
            order by q.createdAt desc
            """)
    List<ExamQuestionPaper> findVisibleForTeacher(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("teacherId") Long teacherId
    );
}
