package com.erp.backend.transport.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.transport.entity.TransportRouteStop;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportRouteStopRepository extends JpaRepository<TransportRouteStop, Long> {

    List<TransportRouteStop> findAllByRouteIdOrderByStopOrderAsc(Long routeId);

    Optional<TransportRouteStop> findByRouteIdAndStopNameIgnoreCase(Long routeId, String stopName);

    Optional<TransportRouteStop> findByRouteInstituteIdAndId(Long instituteId, Long id);
}
