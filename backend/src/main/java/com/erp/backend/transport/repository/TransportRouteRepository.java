package com.erp.backend.transport.repository;

import java.util.Optional;

import com.erp.backend.transport.entity.TransportRoute;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportRouteRepository extends JpaRepository<TransportRoute, Long> {

    Optional<TransportRoute> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<TransportRoute> findByInstituteIdAndRouteCodeIgnoreCase(Long instituteId, String routeCode);
}
