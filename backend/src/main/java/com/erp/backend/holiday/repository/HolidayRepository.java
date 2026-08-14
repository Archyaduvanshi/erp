package com.erp.backend.holiday.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.holiday.entity.Holiday;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HolidayRepository extends JpaRepository<Holiday, Long> {

    List<Holiday> findAllByInstituteIdOrderByHolidayDateAsc(Long instituteId);

    Optional<Holiday> findByInstituteIdAndId(Long instituteId, Long id);
}
