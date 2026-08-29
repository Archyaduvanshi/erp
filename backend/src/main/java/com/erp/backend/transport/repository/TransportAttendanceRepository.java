package com.erp.backend.transport.repository;

import java.time.LocalDate;
import java.util.List;

import com.erp.backend.transport.entity.TransportAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransportAttendanceRepository extends JpaRepository<TransportAttendance, Long> {

    List<TransportAttendance> findAllByInstituteIdOrderByAttendanceDateDescCreatedAtDesc(Long instituteId);

    List<TransportAttendance> findAllByInstituteIdAndDriverIdOrderByAttendanceDateDescCreatedAtDesc(Long instituteId, Long driverId);

    @Query("""
            select a
            from TransportAttendance a
            join fetch a.student s
            join fetch a.driver d
            where a.institute.id = :instituteId
              and d.id = :driverId
              and a.attendanceDate = :attendanceDate
            order by s.assignedClass asc, s.firstName asc, s.lastName asc, a.createdAt asc
            """)
    List<TransportAttendance> findDayWithStudentAndDriver(
            @Param("instituteId") Long instituteId,
            @Param("driverId") Long driverId,
            @Param("attendanceDate") LocalDate attendanceDate
    );

    @Query("""
            select a
            from TransportAttendance a
            join fetch a.student s
            join fetch a.driver d
            where a.institute.id = :instituteId
              and d.id = :driverId
              and a.attendanceDate between :from and :to
            order by a.attendanceDate asc, s.assignedClass asc, s.firstName asc, s.lastName asc, a.createdAt asc
            """)
    List<TransportAttendance> findMonthWithStudentAndDriver(
            @Param("instituteId") Long instituteId,
            @Param("driverId") Long driverId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    @Query("""
            select a
            from TransportAttendance a
            join fetch a.student s
            join fetch a.driver d
            left join fetch a.route r
            left join fetch a.routeOperation o
            where a.institute.id = :instituteId
              and r.id = :routeId
              and a.attendanceDate = :attendanceDate
            order by s.assignedClass asc, s.firstName asc, s.lastName asc, a.createdAt asc
            """)
    List<TransportAttendance> findDayWithStudentAndRoute(
            @Param("instituteId") Long instituteId,
            @Param("routeId") Long routeId,
            @Param("attendanceDate") LocalDate attendanceDate
    );

    @Query("""
            select a
            from TransportAttendance a
            join fetch a.student s
            join fetch a.driver d
            left join fetch a.route r
            left join fetch a.routeOperation o
            where a.institute.id = :instituteId
              and r.id = :routeId
              and a.attendanceDate between :from and :to
            order by a.attendanceDate asc, s.assignedClass asc, s.firstName asc, s.lastName asc, a.createdAt asc
            """)
    List<TransportAttendance> findMonthWithStudentAndRoute(
            @Param("instituteId") Long instituteId,
            @Param("routeId") Long routeId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    @Query("""
            select a
            from TransportAttendance a
            join fetch a.student s
            join fetch a.driver d
            where a.institute.id = :instituteId
              and s.id = :studentId
              and a.attendanceDate between :from and :to
            order by a.attendanceDate desc, a.createdAt desc
            """)
    List<TransportAttendance> findStudentMonthWithDriver(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    List<TransportAttendance> findAllByInstituteIdAndDriverIdAndAttendanceDate(Long instituteId, Long driverId, LocalDate attendanceDate);

    List<TransportAttendance> findAllByInstituteIdAndRouteIdAndAttendanceDate(Long instituteId, Long routeId, LocalDate attendanceDate);

    long countByInstituteIdAndAttendanceDateAndStatusIgnoreCase(Long instituteId, LocalDate attendanceDate, String status);
}
