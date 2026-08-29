package com.erp.backend.transport.repository;

import java.util.Optional;

import com.erp.backend.transport.entity.TransportVehicle;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportVehicleRepository extends JpaRepository<TransportVehicle, Long> {

    Optional<TransportVehicle> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<TransportVehicle> findByInstituteIdAndBusNumberIgnoreCase(Long instituteId, String busNumber);
}
