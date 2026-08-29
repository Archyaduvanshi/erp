package com.erp.backend.examination.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.examination.entity.ExamAdmitCard;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExamAdmitCardRepository extends JpaRepository<ExamAdmitCard, Long> {
    List<ExamAdmitCard> findAllByInstituteIdOrderByExamDateAscCreatedAtDesc(Long instituteId);

    Optional<ExamAdmitCard> findByInstituteIdAndId(Long instituteId, Long id);

    long countByInstituteIdAndAcademicSessionId(Long instituteId, Long academicSessionId);

    @Query("""
            select count(a)
            from ExamAdmitCard a
            where a.institute.id = :instituteId
              and a.academicSession.id = :academicSessionId
              and upper(coalesce(a.status, 'GENERATED')) <> 'ARCHIVED'
            """)
    long countActiveBySession(@Param("instituteId") Long instituteId, @Param("academicSessionId") Long academicSessionId);

    Optional<ExamAdmitCard> findByInstituteIdAndAcademicSessionIdAndExamIdAndStudent_Id(
            Long instituteId,
            Long academicSessionId,
            Long examId,
            Long studentId
    );

    List<ExamAdmitCard> findAllByInstituteIdAndAcademicSessionIdAndExamIdAndStudent_IdIn(
            Long instituteId,
            Long academicSessionId,
            Long examId,
            java.util.Collection<Long> studentIds
    );

    @Query("""
            select a
            from ExamAdmitCard a
            where a.institute.id = :instituteId
              and (:academicSessionId is null or (a.academicSession is not null and a.academicSession.id = :academicSessionId))
              and (:examId is null or (a.exam is not null and a.exam.id = :examId))
              and (:classId is null or (a.schoolClass is not null and a.schoolClass.id = :classId))
              and (:status = '' or upper(coalesce(a.status, 'GENERATED')) = upper(:status))
              and upper(coalesce(a.status, 'GENERATED')) <> 'ARCHIVED'
              and (:search = '' or lower(concat(coalesce(a.examTitle, ''), ' ', coalesce(a.studentName, ''), ' ', coalesce(a.studentId, ''), ' ', coalesce(a.rollNo, ''), ' ', coalesce(a.className, ''))) like lower(concat('%', :search, '%')))
            order by a.createdAt desc
            """)
    Page<ExamAdmitCard> findAdmitCards(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("examId") Long examId,
            @Param("classId") Long classId,
            @Param("status") String status,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("""
            select a
            from ExamAdmitCard a
            where a.institute.id = :instituteId
              and upper(coalesce(a.status, 'GENERATED')) = 'PUBLISHED'
              and (:academicSessionId is null or a.academicSession is null or a.academicSession.id = :academicSessionId)
              and (
                (a.student is not null and a.student.id = :studentId)
                or a.studentId = :studentToken
              )
            order by a.examDate asc, a.createdAt desc
            """)
    List<ExamAdmitCard> findPublishedForStudent(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("studentId") Long studentId,
            @Param("studentToken") String studentToken
    );
}
