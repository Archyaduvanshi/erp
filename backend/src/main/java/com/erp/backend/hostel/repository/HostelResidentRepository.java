package com.erp.backend.hostel.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.hostel.entity.HostelResident;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HostelResidentRepository extends JpaRepository<HostelResident, Long> {

    List<HostelResident> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<HostelResident> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<HostelResident> findByInstituteIdAndStudentId(Long instituteId, Long studentId);

    List<HostelResident> findAllByInstituteIdAndRoomId(Long instituteId, Long roomId);

    List<HostelResident> findAllByInstituteIdAndRoomHostelId(Long instituteId, Long hostelId);
}
