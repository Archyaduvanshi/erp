package com.erp.backend.transport.repository;

import java.time.LocalDate;
import java.util.List;

import com.erp.backend.transport.entity.TransportAttendance;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportAttendanceRepository extends JpaRepository<TransportAttendance, Long> {

    List<TransportAttendance> findAllByInstituteIdOrderByAttendanceDateDescCreatedAtDesc(Long instituteId);

    List<TransportAttendance> findAllByInstituteIdAndDriverIdOrderByAttendanceDateDescCreatedAtDesc(Long instituteId, Long driverId);

    List<TransportAttendance> findAllByInstituteIdAndDriverIdAndAttendanceDate(Long instituteId, Long driverId, LocalDate attendanceDate);
}
