package com.erp.backend.marks.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.marks.entity.MarksRegister;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MarksRegisterRepository extends JpaRepository<MarksRegister, Long> {

    Optional<MarksRegister> findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSubjectIdAndExamId(
            Long instituteId,
            Long academicSessionId,
            Long classId,
            Long subjectId,
            Long examId
    );

    Optional<MarksRegister> findByInstituteIdAndId(Long instituteId, Long id);

    List<MarksRegister> findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndExamId(
            Long instituteId,
            Long academicSessionId,
            Long classId,
            Long examId
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update MarksRegister r
            set r.status = :status,
                r.updatedByAccountId = :accountId
            where r.institute.id = :instituteId
              and r.academicSession.id = :academicSessionId
              and r.schoolClass.id = :classId
              and r.exam.id = :examId
            """)
    int updateStatusForExam(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("classId") Long classId,
            @Param("examId") Long examId,
            @Param("status") String status,
            @Param("accountId") Long accountId
    );
}
