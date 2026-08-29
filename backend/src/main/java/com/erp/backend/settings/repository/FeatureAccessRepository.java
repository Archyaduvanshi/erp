package com.erp.backend.settings.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.settings.entity.FeatureAccess;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FeatureAccessRepository extends JpaRepository<FeatureAccess, Long> {
    List<FeatureAccess> findAllByInstituteIdOrderByFeatureKeyAsc(Long instituteId);

    @Query("""
            select access
            from FeatureAccess access
            where access.institute.id = :instituteId
              and access.featureKey = :featureKey
              and access.teacher is null
            """)
    Optional<FeatureAccess> findLegacyByInstituteIdAndFeatureKey(
            @Param("instituteId") Long instituteId,
            @Param("featureKey") String featureKey
    );

    Optional<FeatureAccess> findByInstituteIdAndFeatureKeyAndTeacherId(Long instituteId, String featureKey, Long teacherId);

    List<FeatureAccess> findAllByInstituteIdAndTeacherIdAndEnabledTrueOrderByFeatureKeyAsc(Long instituteId, Long teacherId);
}
