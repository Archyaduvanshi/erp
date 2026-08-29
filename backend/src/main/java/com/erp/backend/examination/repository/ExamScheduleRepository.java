package com.erp.backend.examination.repository;

import com.erp.backend.examination.entity.ExamSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExamScheduleRepository extends JpaRepository<ExamSchedule, Long> {
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            delete from ExamSchedule s
            where s.institute.id = :instituteId
              and s.academicSession.id = :academicSessionId
              and s.exam.id = :examId
              and s.schoolClass.id in :classIds
            """)
    int deleteForExamClasses(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("examId") Long examId,
            @Param("classIds") java.util.Collection<Long> classIds
    );
}
