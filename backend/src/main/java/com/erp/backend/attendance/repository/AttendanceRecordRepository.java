package com.erp.backend.attendance.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.erp.backend.attendance.entity.AttendanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, Long> {

    List<AttendanceRecord> findAllByInstituteIdOrderByAttendanceDateDescCreatedAtDesc(Long instituteId);

    List<AttendanceRecord> findAllByInstituteIdAndClassNameIgnoreCaseOrderByAttendanceDateDescCreatedAtDesc(Long instituteId, String className);

    List<AttendanceRecord> findAllByInstituteIdAndClassNameIgnoreCaseAndAttendanceDateAndLectureNumber(
            Long instituteId,
            String className,
            LocalDate attendanceDate,
            String lectureNumber
    );

    Optional<AttendanceRecord> findByInstituteIdAndId(Long instituteId, Long id);
}
