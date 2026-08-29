package com.erp.backend.attendance.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.erp.backend.attendance.entity.TeacherAttendanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeacherAttendanceRecordRepository extends JpaRepository<TeacherAttendanceRecord, Long> {

    List<TeacherAttendanceRecord> findAllByInstituteIdAndAttendanceDate(Long instituteId, LocalDate attendanceDate);

    List<TeacherAttendanceRecord> findAllByInstituteIdAndAttendanceDateBetween(Long instituteId, LocalDate fromDate, LocalDate toDate);

    List<TeacherAttendanceRecord> findAllByInstituteIdAndTeacherIdAndAttendanceDateBetween(Long instituteId, Long teacherId, LocalDate fromDate, LocalDate toDate);

    @Query("""
            select count(r)
            from TeacherAttendanceRecord r
            where r.institute.id = :instituteId
              and r.teacher.id = :teacherId
              and r.attendanceDate between :fromDate and :toDate
              and lower(coalesce(r.status, '')) in :statuses
            """)
    long countByTeacherStatuses(
            @Param("instituteId") Long instituteId,
            @Param("teacherId") Long teacherId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            @Param("statuses") List<String> statuses
    );

    Optional<TeacherAttendanceRecord> findByInstituteIdAndId(Long instituteId, Long id);
}
