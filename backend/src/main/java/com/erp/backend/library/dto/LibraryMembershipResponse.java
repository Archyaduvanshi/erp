package com.erp.backend.library.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record LibraryMembershipResponse(
    Long id,
    Long studentId,
    Long instituteId,
    String membershipType,
    String status,
    BigDecimal monthlyCharge,
    String libraryCardNumber,
    String enrollmentMonth,
    String enrollmentYear,
    String remarks,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
