package com.erp.backend.hostel.repository;

import java.util.Optional;

import com.erp.backend.hostel.entity.HostelMessMenu;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HostelMessMenuRepository extends JpaRepository<HostelMessMenu, Long> {

    Optional<HostelMessMenu> findByInstituteIdAndHostelId(Long instituteId, Long hostelId);
}
