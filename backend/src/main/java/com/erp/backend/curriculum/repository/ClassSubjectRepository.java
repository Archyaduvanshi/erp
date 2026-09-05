package com.erp.backend.curriculum.repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.erp.backend.curriculum.dto.ClassSubjectResponse;
import com.erp.backend.curriculum.dto.CurriculumClassSummaryResponse;
import com.erp.backend.curriculum.entity.ClassSubject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClassSubjectRepository extends JpaRepository<ClassSubject, Long> {

    Optional<ClassSubject> findByInstituteIdAndId(Long instituteId, Long id);

    List<ClassSubject> findAllByInstituteIdAndIdIn(Long instituteId, Set<Long> ids);

    List<ClassSubject> findAllByInstituteIdAndAcademicSessionId(Long instituteId, Long academicSessionId);

    Optional<ClassSubject> findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSubjectId(
            Long instituteId,
            Long academicSessionId,
            Long schoolClassId,
            Long subjectId
    );

    List<ClassSubject> findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdOrderByDisplayOrderAscSubject_NameAsc(
            Long instituteId,
            Long academicSessionId,
            Long schoolClassId
    );

    @Query("""
            select new com.erp.backend.curriculum.dto.CurriculumClassSummaryResponse(
                c.id,
                c.name,
                c.code,
                coalesce(c.displayOrder, 0),
                count(distinct cs.id),
                count(distinct cb.id),
                count(distinct sec.id),
                c.status
            )
            from SchoolClass c
            left join ClassSubject cs on cs.schoolClass = c
                and cs.institute.id = :instituteId
                and cs.academicSession.id = :academicSessionId
            left join CourseBook cb on cb.classSubject = cs
            left join ClassSection sec on sec.schoolClass = c
                and sec.institute.id = :instituteId
                and sec.status <> 'ARCHIVED'
            where c.institute.id = :instituteId
              and c.status <> 'ARCHIVED'
            group by c.id, c.name, c.code, c.displayOrder, c.status
            order by coalesce(c.displayOrder, 0) asc, c.name asc
            """)
    List<CurriculumClassSummaryResponse> findClassSummaries(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select new com.erp.backend.curriculum.dto.ClassSubjectResponse(
                cs.id,
                c.id,
                c.name,
                s.id,
                s.name,
                s.code,
                cs.subjectType,
                cs.displayOrder,
                cs.status,
                cs.notes,
                count(cb.id)
            )
            from ClassSubject cs
            join cs.schoolClass c
            join cs.subject s
            left join CourseBook cb on cb.classSubject = cs
            where cs.institute.id = :instituteId
              and cs.academicSession.id = :academicSessionId
              and cs.schoolClass.id = :classId
            group by cs.id, c.id, c.name, s.id, s.name, s.code, cs.subjectType, cs.displayOrder, cs.status, cs.notes
            order by cs.displayOrder asc, s.name asc
            """)
    List<ClassSubjectResponse> findSubjectSummaries(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("classId") Long classId
    );
}
