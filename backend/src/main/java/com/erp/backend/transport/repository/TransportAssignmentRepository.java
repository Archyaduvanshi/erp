package com.erp.backend.transport.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.transport.entity.TransportAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportAssignmentRepository extends JpaRepository<TransportAssignment, Long> {

    List<TransportAssignment> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<TransportAssignment> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<TransportAssignment> findByInstituteIdAndStudentId(Long instituteId, Long studentId);

    List<TransportAssignment> findAllByInstituteIdAndDriverId(Long instituteId, Long driverId);
}
