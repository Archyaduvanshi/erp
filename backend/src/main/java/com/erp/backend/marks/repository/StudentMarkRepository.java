package com.erp.backend.marks.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.erp.backend.result.dto.ResultClassResponse;
import com.erp.backend.result.dto.ResultStudentResponse;
import com.erp.backend.marks.entity.StudentMark;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

public interface StudentMarkRepository extends JpaRepository<StudentMark, Long> {

    List<StudentMark> findAllByInstituteIdOrderByClassNameAscSubjectNameAscExamTitleAscCreatedAtAsc(Long instituteId);

    List<StudentMark> findAllByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseOrderByExamTitleAscCreatedAtAsc(
            Long instituteId,
            String className,
            String subjectName
    );

    List<StudentMark> findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSubjectIdOrderByExamTitleAscCreatedAtAsc(
            Long instituteId,
            Long academicSessionId,
            Long classId,
            Long subjectId
    );

    List<StudentMark> findAllByInstituteIdAndClassNameIgnoreCaseOrderBySubjectNameAscExamTitleAscCreatedAtAsc(
            Long instituteId,
            String className
    );

    List<StudentMark> findAllByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseAndExamTitleIn(
            Long instituteId,
            String className,
            String subjectName,
            Collection<String> examTitles
    );

    Optional<StudentMark> findByInstituteIdAndId(Long instituteId, Long id);

    List<StudentMark> findAllByInstituteIdAndMarksRegisterId(Long instituteId, Long marksRegisterId);

    List<StudentMark> findAllByInstituteIdAndStudentIdAndAcademicSessionIdAndExamIdOrderBySubjectNameAscCreatedAtAsc(
            Long instituteId,
            Long studentId,
            Long academicSessionId,
            Long examId
    );

    List<StudentMark> findAllByInstituteIdAndStudentIdAndAcademicSessionIdOrderByExamDateAscSubjectNameAscCreatedAtAsc(
            Long instituteId,
            Long studentId,
            Long academicSessionId
    );

    @Query("""
            select m
            from StudentMark m
            join ResultPublication p on p.institute = m.institute
                and p.academicSession = m.academicSession
                and p.schoolClass = m.schoolClass
                and p.exam = m.exam
                and upper(p.status) = 'PUBLISHED'
            where m.institute.id = :instituteId
              and m.student.id = :studentId
              and m.academicSession.id = :academicSessionId
              and (:examId is null or m.exam.id = :examId)
            order by m.exam.examDate asc, m.subject.name asc, m.createdAt asc
            """)
    List<StudentMark> findPublishedStudentResults(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("examId") Long examId
    );

    List<StudentMark> findAllByInstituteIdAndStudentIdAndClassNameIgnoreCaseOrderByExamDateAscSubjectNameAscCreatedAtAsc(
            Long instituteId,
            Long studentId,
            String className
    );

    List<StudentMark> findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndExamIdOrderByStudent_FirstNameAscStudent_LastNameAsc(
            Long instituteId,
            Long academicSessionId,
            Long classId,
            Long examId
    );

    List<StudentMark> findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSubjectIdAndExamIdAndStudentIdIn(
            Long instituteId,
            Long academicSessionId,
            Long classId,
            Long subjectId,
            Long examId,
            Set<Long> studentIds
    );

    @Query("""
            select new com.erp.backend.result.dto.ResultClassResponse(
                c.name,
                count(distinct s.id),
                count(distinct m.exam.id),
                count(distinct cs.subject.id)
            )
            from com.erp.backend.curriculum.entity.SchoolClass c
            left join Student s on s.institute.id = c.institute.id
                and lower(coalesce(s.assignedClass, s.className, '')) = lower(c.name)
                and lower(coalesce(s.status, '')) <> 'archived'
            left join com.erp.backend.curriculum.entity.ClassSubject cs on cs.schoolClass = c
                and cs.institute.id = c.institute.id
                and cs.academicSession.id = :academicSessionId
                and upper(coalesce(cs.status, 'ACTIVE')) <> 'ARCHIVED'
            left join StudentMark m on m.schoolClass = c
                and m.institute.id = c.institute.id
                and m.academicSession.id = :academicSessionId
            where c.institute.id = :instituteId
              and upper(coalesce(c.status, 'ACTIVE')) <> 'ARCHIVED'
            group by c.id, c.name
            order by c.name asc
            """)
    List<ResultClassResponse> findResultClassSummaries(@Param("instituteId") Long instituteId, @Param("academicSessionId") Long academicSessionId);

    @Query("""
            select new com.erp.backend.result.dto.ResultStudentResponse(
                s.id,
                coalesce(nullif(trim(concat(coalesce(s.firstName, ''), ' ', coalesce(s.lastName, ''))), ''), coalesce(s.name, s.enrollmentNo, 'Unnamed student')),
                coalesce(s.rollNo, s.enrollmentNo, cast(s.id as string)),
                coalesce(s.assignedClass, s.className),
                count(distinct cs.subject.id),
                case
                    when count(distinct cs.subject.id) = 0 then 'Pending'
                    when count(distinct m.subject.id) < count(distinct cs.subject.id) then 'Pending'
                    when max(case when upper(coalesce(m.status, 'PRESENT')) = 'NOT_ENTERED' then 1 else 0 end) = 1 then 'Pending'
                    when min(case when upper(coalesce(m.status, 'PRESENT')) = 'EXEMPT' then 1 else 0 end) = 1 then 'Exempt'
                    when max(case when upper(coalesce(m.status, 'PRESENT')) = 'ABSENT' then 1 else 0 end) = 1 then 'Fail'
                    when min(case
                        when upper(coalesce(m.status, 'PRESENT')) = 'EXEMPT' then 1
                        when m.maxMarks is null or m.maxMarks <= 0 then 0
                        when (m.marksObtained * 100.0 / nullif(m.maxMarks, 0)) >= :passPercentage then 1
                        else 0
                    end) = 1 then 'Pass'
                    else 'Fail'
                end
            )
            from Student s
            left join com.erp.backend.curriculum.entity.ClassSubject cs on cs.institute.id = s.institute.id
                and cs.academicSession.id = :academicSessionId
                and lower(coalesce(s.assignedClass, s.className, '')) = lower(cs.schoolClass.name)
                and upper(coalesce(cs.status, 'ACTIVE')) <> 'ARCHIVED'
            left join StudentMark m on m.student = s
                and m.institute.id = s.institute.id
                and m.academicSession.id = :academicSessionId
                and m.subject = cs.subject
                and (:examId is null or m.exam.id = :examId)
            where s.institute.id = :instituteId
              and lower(coalesce(s.assignedClass, s.className, '')) = lower(:className)
              and lower(coalesce(s.status, '')) <> 'archived'
            group by s.id, s.firstName, s.lastName, s.name, s.enrollmentNo, s.rollNo, s.assignedClass, s.className
            order by s.firstName asc, s.lastName asc, s.rollNo asc
            """)
    List<ResultStudentResponse> findResultStudents(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("className") String className,
            @Param("examId") Long examId,
            @Param("passPercentage") java.math.BigDecimal passPercentage
    );
}
