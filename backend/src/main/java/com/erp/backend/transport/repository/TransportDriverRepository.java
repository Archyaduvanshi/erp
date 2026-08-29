package com.erp.backend.transport.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.transport.entity.TransportDriver;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransportDriverRepository extends JpaRepository<TransportDriver, Long> {

    List<TransportDriver> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<TransportDriver> findByInstituteIdAndId(Long instituteId, Long id);

    long countByInstituteIdAndStatusIgnoreCase(Long instituteId, String status);

    @Query("""
            select count(distinct d.busNumber)
            from TransportDriver d
            where d.institute.id = :instituteId
              and lower(coalesce(d.status, 'active')) = 'active'
              and d.busNumber is not null
            """)
    long countActiveVehicles(@Param("instituteId") Long instituteId);

    @Query("""
            select count(distinct d.routeName)
            from TransportDriver d
            where d.institute.id = :instituteId
              and lower(coalesce(d.status, 'active')) = 'active'
              and d.routeName is not null
            """)
    long countActiveRoutes(@Param("instituteId") Long instituteId);
}
