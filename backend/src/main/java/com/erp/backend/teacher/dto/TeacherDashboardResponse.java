package com.erp.backend.teacher.dto;

import java.math.BigDecimal;
import java.util.List;

import com.erp.backend.notice.dto.PortalNoticeResponse;

public record TeacherDashboardResponse(
        Long teacherId,
        String teacherName,
        String employeeId,
        String specialization,
        String photoUrl,
        Long academicSessionId,
        String academicSessionName,
        long assignedClassCount,
        long assignedStudentCount,
        long todayPresent,
        long todayAbsent,
        long todayLeave,
        long todayPending,
        long todayTotal,
        boolean attendanceMarked,
        long completedTargetCount,
        long totalTargetCount,
        String salaryMonthKey,
        String salaryStatus,
        BigDecimal salaryNetPayable,
        BigDecimal salaryPaidAmount,
        BigDecimal salaryOutstanding,
        long noticeCount,
        List<PortalNoticeResponse> latestNotices
) {
}
