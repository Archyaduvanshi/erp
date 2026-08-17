package com.erp.backend.settings.dto;

public record NotificationsPayload(
        boolean emailNotice,
        boolean smsAlerts,
        boolean holidayNotice,
        boolean feeReminders,
        boolean attendanceAlerts
) {
}
