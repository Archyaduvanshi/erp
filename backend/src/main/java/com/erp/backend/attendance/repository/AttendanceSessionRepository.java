package com.erp.backend.attendance.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.erp.backend.attendance.entity.AttendanceSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttendanceSessionRepository extends JpaRepository<AttendanceSession, Long> {

    @Query("""
            select s
            from AttendanceSession s
            left join fetch s.classSubject cs
            left join fetch cs.subject sub
            left join fetch s.markedByTeacher teacher
            where s.institute.id = :instituteId
              and s.academicSession.id = :academicSessionId
              and s.schoolClass.id = :classId
              and (:sectionId is null and s.section is null or s.section.id = :sectionId)
              and s.attendanceDate = :attendanceDate
              and s.periodNumber = :periodNumber
            """)
    Optional<AttendanceSession> findLogicalSession(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("classId") Long classId,
            @Param("sectionId") Long sectionId,
            @Param("attendanceDate") LocalDate attendanceDate,
            @Param("periodNumber") Integer periodNumber
    );

    @Query("""
            select s
            from AttendanceSession s
            left join fetch s.classSubject cs
            left join fetch cs.subject sub
            left join fetch s.markedByTeacher teacher
            where s.institute.id = :instituteId
              and s.academicSession.id = :academicSessionId
              and s.schoolClass.id = :classId
              and (:sectionId is null and s.section is null or s.section.id = :sectionId)
              and s.attendanceDate between :fromDate and :toDate
            order by s.attendanceDate asc, s.periodNumber asc
            """)
    List<AttendanceSession> findMonthSessions(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId,
            @Param("classId") Long classId,
            @Param("sectionId") Long sectionId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate
    );
}
