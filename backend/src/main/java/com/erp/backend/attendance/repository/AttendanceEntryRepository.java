package com.erp.backend.attendance.repository;

import java.util.Collection;
import java.util.List;

import com.erp.backend.attendance.entity.AttendanceEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttendanceEntryRepository extends JpaRepository<AttendanceEntry, Long> {

    List<AttendanceEntry> findAllByAttendanceSessionId(Long attendanceSessionId);

    List<AttendanceEntry> findAllByAttendanceSessionIdIn(Collection<Long> attendanceSessionIds);

    void deleteAllByAttendanceSessionId(Long attendanceSessionId);

    @Query("""
            select e
            from AttendanceEntry e
            join fetch e.attendanceSession s
            join fetch s.schoolClass c
            left join fetch s.section sec
            left join fetch s.classSubject cs
            left join fetch cs.subject sub
            left join fetch s.markedByTeacher teacher
            where s.institute.id = :instituteId
              and e.student.id = :studentId
              and s.attendanceDate between :fromDate and :toDate
            order by s.attendanceDate desc, s.periodNumber asc
            """)
    List<AttendanceEntry> findStudentMonthEntries(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("fromDate") java.time.LocalDate fromDate,
            @Param("toDate") java.time.LocalDate toDate
    );
}
