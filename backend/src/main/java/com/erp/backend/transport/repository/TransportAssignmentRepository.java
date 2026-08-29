package com.erp.backend.transport.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.transport.entity.TransportAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransportAssignmentRepository extends JpaRepository<TransportAssignment, Long> {

    List<TransportAssignment> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<TransportAssignment> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<TransportAssignment> findByInstituteIdAndStudentId(Long instituteId, Long studentId);

    Optional<TransportAssignment> findByInstituteIdAndAcademicSessionIdAndStudentId(Long instituteId, Long academicSessionId, Long studentId);

    @Query("""
            select a
            from TransportAssignment a
            join fetch a.student s
            left join fetch a.driver d
            left join fetch a.academicSession session
            left join fetch a.route r
            left join fetch a.pickupStopRef stop
            where a.institute.id = :instituteId
              and s.id = :studentId
              and (:academicSessionId is null or session.id = :academicSessionId)
              and lower(coalesce(a.status, 'active')) = 'active'
            """)
    Optional<TransportAssignment> findStudentAssignment(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("academicSessionId") Long academicSessionId
    );

    long countByInstituteIdAndDriverIsNotNull(Long instituteId);

    long countByInstituteIdAndAcademicSessionIdAndRouteIdAndStatusIgnoreCase(Long instituteId, Long academicSessionId, Long routeId, String status);

    @Query("""
            select r.id, count(a)
            from TransportAssignment a
            join a.route r
            join a.academicSession session
            where a.institute.id = :instituteId
              and session.id = :academicSessionId
              and lower(coalesce(a.status, 'active')) = 'active'
            group by r.id
            """)
    List<Object[]> countActiveAssignmentsByRoute(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select a
            from TransportAssignment a
            join fetch a.student s
            left join fetch a.driver d
            left join fetch a.academicSession session
            left join fetch a.route r
            left join fetch a.pickupStopRef stop
            where a.institute.id = :instituteId
              and (:academicSessionId is null or session.id = :academicSessionId)
            order by a.createdAt desc
            """)
    List<TransportAssignment> findAllWithStudentAndDriver(
            @Param("instituteId") Long instituteId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select a
            from TransportAssignment a
            join fetch a.student s
            left join fetch a.driver d
            left join fetch a.academicSession session
            left join fetch a.route r
            left join fetch a.pickupStopRef stop
            where a.institute.id = :instituteId
              and d.id = :driverId
              and (:academicSessionId is null or session.id = :academicSessionId)
              and lower(coalesce(a.status, 'active')) = 'active'
            order by s.assignedClass asc, s.firstName asc, s.lastName asc, a.createdAt asc
            """)
    List<TransportAssignment> findAllByInstituteIdAndDriverId(
            @Param("instituteId") Long instituteId,
            @Param("driverId") Long driverId,
            @Param("academicSessionId") Long academicSessionId
    );

    @Query("""
            select a
            from TransportAssignment a
            join fetch a.student s
            left join fetch a.driver d
            left join fetch a.academicSession session
            left join fetch a.route r
            left join fetch a.pickupStopRef stop
            where a.institute.id = :instituteId
              and r.id = :routeId
              and (:academicSessionId is null or session.id = :academicSessionId)
              and lower(coalesce(a.status, 'active')) = 'active'
            order by s.assignedClass asc, s.firstName asc, s.lastName asc, a.createdAt asc
            """)
    List<TransportAssignment> findAllByInstituteIdAndRouteId(
            @Param("instituteId") Long instituteId,
            @Param("routeId") Long routeId,
            @Param("academicSessionId") Long academicSessionId
    );
}
