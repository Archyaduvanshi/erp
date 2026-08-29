package com.erp.backend.fee.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record FeeReceiptSearchResponse(
        Long id,
        Long studentId,
        String enrollmentNo,
        String studentName,
        String className,
        String section,
        String receiptNumber,
        String transactionId,
        String mode,
        String paymentStatus,
        BigDecimal paidAmount,
        BigDecimal balanceRemaining,
        LocalDate paymentDate,
        String notificationStatus
) {
}
