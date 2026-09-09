package com.erp.backend.settings.repository;

import java.util.Optional;

import com.erp.backend.settings.entity.CollegeSettings;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CollegeSettingsRepository extends JpaRepository<CollegeSettings, Long> {
    @EntityGraph(attributePaths = "institute")
    Optional<CollegeSettings> findByInstituteId(Long instituteId);
}
