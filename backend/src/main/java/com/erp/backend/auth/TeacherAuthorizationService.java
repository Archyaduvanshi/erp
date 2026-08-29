package com.erp.backend.auth;

import com.erp.backend.settings.entity.FeatureAccess;
import com.erp.backend.settings.repository.FeatureAccessRepository;
import org.springframework.stereotype.Service;

@Service("teacherAuth")
public class TeacherAuthorizationService {
    private final FeatureAccessRepository featureAccessRepository;

    public TeacherAuthorizationService(FeatureAccessRepository featureAccessRepository) {
        this.featureAccessRepository = featureAccessRepository;
    }

    public boolean canRead(AuthPrincipal principal, String featureKey) {
        return access(principal, featureKey) != null;
    }

    public boolean canWrite(AuthPrincipal principal, String featureKey) {
        FeatureAccess access = access(principal, featureKey);
        return access != null && "read_write".equalsIgnoreCase(access.getOperation());
    }

    private FeatureAccess access(AuthPrincipal principal, String featureKey) {
        if (principal == null || !"TEACHER".equals(principal.role()) || principal.teacherId() == null) {
            return null;
        }
        return featureAccessRepository
                .findByInstituteIdAndFeatureKeyAndTeacherId(principal.instituteId(), featureKey, principal.teacherId())
                .filter(FeatureAccess::isEnabled)
                .orElse(null);
    }
}
