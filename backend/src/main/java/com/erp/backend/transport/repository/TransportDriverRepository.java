package com.erp.backend.transport.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.transport.entity.TransportDriver;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportDriverRepository extends JpaRepository<TransportDriver, Long> {

    List<TransportDriver> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<TransportDriver> findByInstituteIdAndId(Long instituteId, Long id);
}
