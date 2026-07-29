package com.erp.backend.library.dto;

import java.math.BigDecimal;

public record LibraryMembershipPayload(
    Long studentId,
    String membershipType,
    BigDecimal monthlyCharge,
    String status,
    String remarks
) {}
