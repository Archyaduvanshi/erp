package com.erp.backend.fee.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.fee.entity.FeeStructure;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeeStructureRepository extends JpaRepository<FeeStructure, Long> {

    List<FeeStructure> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<FeeStructure> findByInstituteIdAndId(Long instituteId, Long id);
}
