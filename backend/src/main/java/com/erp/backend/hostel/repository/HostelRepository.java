package com.erp.backend.hostel.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.hostel.entity.Hostel;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HostelRepository extends JpaRepository<Hostel, Long> {

    List<Hostel> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<Hostel> findByInstituteIdAndId(Long instituteId, Long id);
}
