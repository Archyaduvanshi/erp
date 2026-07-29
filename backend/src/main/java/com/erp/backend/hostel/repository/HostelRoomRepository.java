package com.erp.backend.hostel.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.hostel.entity.HostelRoom;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HostelRoomRepository extends JpaRepository<HostelRoom, Long> {

    List<HostelRoom> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<HostelRoom> findByInstituteIdAndId(Long instituteId, Long id);

    List<HostelRoom> findAllByInstituteIdAndHostelIdOrderByCreatedAtDesc(Long instituteId, Long hostelId);
}
