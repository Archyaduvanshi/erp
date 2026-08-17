package com.erp.backend.settings.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.settings.entity.FeatureAccess;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeatureAccessRepository extends JpaRepository<FeatureAccess, Long> {
    List<FeatureAccess> findAllByInstituteIdOrderByFeatureKeyAsc(Long instituteId);

    Optional<FeatureAccess> findByInstituteIdAndFeatureKey(Long instituteId, String featureKey);
}
