package com.erp.backend.teacher.dto;

import java.util.List;

public record TeacherPaymentPayload(
        String monthKey,
        Object baseSalary,
        Object previousPendingAmount,
        Object bonusAmount,
        Object advanceAmount,
        Object amount,
        Object totalAmount,
        String paidOn,
        String note,
        List<String> settledMonthKeys
) {
}
