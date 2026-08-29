package com.erp.backend.transport.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.erp.backend.transport.entity.TransportRouteOperation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransportRouteOperationRepository extends JpaRepository<TransportRouteOperation, Long> {

    Optional<TransportRouteOperation> findByInstituteIdAndId(Long instituteId, Long id);

    @Query("""
            select o
            from TransportRouteOperation o
            join fetch o.route r
            join fetch o.driver d
            join fetch o.vehicle v
            where o.institute.id = :instituteId
              and d.id = :driverId
              and lower(coalesce(o.status, 'active')) = 'active'
              and (o.effectiveFrom is null or o.effectiveFrom <= :date)
              and (o.effectiveTo is null or o.effectiveTo >= :date)
            order by o.effectiveFrom desc nulls last, o.id desc
            """)
    Optional<TransportRouteOperation> findActiveByDriver(
            @Param("instituteId") Long instituteId,
            @Param("driverId") Long driverId,
            @Param("date") LocalDate date
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select o
            from TransportRouteOperation o
            join fetch o.route r
            join fetch o.driver d
            join fetch o.vehicle v
            where o.institute.id = :instituteId
              and r.id = :routeId
              and lower(coalesce(o.status, 'active')) = 'active'
              and (o.effectiveFrom is null or o.effectiveFrom <= :date)
              and (o.effectiveTo is null or o.effectiveTo >= :date)
            order by o.effectiveFrom desc nulls last, o.id desc
            """)
    Optional<TransportRouteOperation> findActiveByRouteForUpdate(
            @Param("instituteId") Long instituteId,
            @Param("routeId") Long routeId,
            @Param("date") LocalDate date
    );

    @Query("""
            select o
            from TransportRouteOperation o
            join fetch o.route r
            join fetch o.driver d
            join fetch o.vehicle v
            where o.institute.id = :instituteId
              and r.id = :routeId
              and lower(coalesce(o.status, 'active')) = 'active'
              and (o.effectiveFrom is null or o.effectiveFrom <= :date)
              and (o.effectiveTo is null or o.effectiveTo >= :date)
            order by o.effectiveFrom desc nulls last, o.id desc
            """)
    Optional<TransportRouteOperation> findActiveByRoute(
            @Param("instituteId") Long instituteId,
            @Param("routeId") Long routeId,
            @Param("date") LocalDate date
    );

    @Query("""
            select o
            from TransportRouteOperation o
            join fetch o.route r
            join fetch o.driver d
            join fetch o.vehicle v
            where o.institute.id = :instituteId
              and lower(coalesce(o.status, 'active')) = 'active'
              and (o.effectiveFrom is null or o.effectiveFrom <= :date)
              and (o.effectiveTo is null or o.effectiveTo >= :date)
            order by r.routeName asc, d.driverName asc
            """)
    List<TransportRouteOperation> findActiveOperations(
            @Param("instituteId") Long instituteId,
            @Param("date") LocalDate date
    );

    @Query("""
            select o
            from TransportRouteOperation o
            join fetch o.route r
            join fetch o.driver d
            join fetch o.vehicle v
            where o.institute.id = :instituteId
              and (:operationId is null or o.id <> :operationId)
              and lower(coalesce(o.status, 'active')) = 'active'
              and (r.id = :routeId or d.id = :driverId or v.id = :vehicleId)
              and (o.effectiveFrom is null or o.effectiveFrom <= :rangeEnd)
              and (o.effectiveTo is null or o.effectiveTo >= :rangeStart)
            """)
    List<TransportRouteOperation> findOverlappingOperations(
            @Param("instituteId") Long instituteId,
            @Param("operationId") Long operationId,
            @Param("routeId") Long routeId,
            @Param("driverId") Long driverId,
            @Param("vehicleId") Long vehicleId,
            @Param("rangeStart") LocalDate rangeStart,
            @Param("rangeEnd") LocalDate rangeEnd
    );
}
