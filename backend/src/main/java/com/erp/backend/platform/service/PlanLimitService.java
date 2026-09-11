package com.erp.backend.platform.service;

import org.springframework.stereotype.Service;

@Service
public class PlanLimitService {
    public enum Resource { STUDENTS, TEACHERS, USERS }

    private final EntitlementService entitlements;

    public PlanLimitService(EntitlementService entitlements) { this.entitlements = entitlements; }

    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void assertCanAdd(Long instituteId, Resource resource, int requested) {
        entitlements.validatePlanLimits(instituteId,resource,requested);
    }
}
