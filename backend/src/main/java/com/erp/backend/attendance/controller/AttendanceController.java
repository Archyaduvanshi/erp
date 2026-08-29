package com.erp.backend.attendance.controller;

import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.attendance.dto.AttendanceMonthResponse;
import com.erp.backend.attendance.dto.AttendanceResponse;
import com.erp.backend.attendance.dto.AttendanceSessionResponse;
import com.erp.backend.attendance.dto.AttendanceSessionSaveRequest;
import com.erp.backend.attendance.dto.AttendanceStudentResponse;
import com.erp.backend.attendance.dto.AttendanceTargetResponse;
import com.erp.backend.attendance.dto.TeacherAttendanceMonthResponse;
import com.erp.backend.attendance.dto.TeacherAttendanceResponse;
import com.erp.backend.attendance.dto.TeacherAttendanceSaveRequest;
import com.erp.backend.attendance.dto.TeacherAttendanceTargetResponse;
import com.erp.backend.attendance.service.AttendanceService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;

    public AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    @GetMapping("/targets")
    public List<AttendanceTargetResponse> getAttendanceTargets(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam Long academicSessionId
    ) {
        return attendanceService.getAttendanceTargets(instituteId, academicSessionId);
    }

    @GetMapping("/classes/{classId}/students")
    public List<AttendanceStudentResponse> getClassStudents(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long classId,
            @RequestParam Long academicSessionId,
            @RequestParam(required = false) Long sectionId
    ) {
        return attendanceService.getClassStudents(principal, academicSessionId, classId, sectionId);
    }

    @GetMapping("/classes/{classId}/session")
    public AttendanceSessionResponse getAttendanceSession(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long classId,
            @RequestParam Long academicSessionId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam String date,
            @RequestParam(required = false) Integer periodNumber
    ) {
        return attendanceService.getAttendanceSession(principal, academicSessionId, classId, sectionId, date, periodNumber);
    }

    @PutMapping("/classes/{classId}/session")
    public AttendanceSessionResponse saveAttendanceSession(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classId,
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody AttendanceSessionSaveRequest request
    ) {
        return attendanceService.saveAttendanceSession(principal, request);
    }

    @GetMapping("/classes/{classId}/monthly")
    public AttendanceMonthResponse getMonthlyAttendance(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classId,
            @RequestParam Long academicSessionId,
            @RequestParam(required = false) Long sectionId,
            @RequestParam String month,
            @RequestParam(required = false) Long teacherId
    ) {
        return attendanceService.getMonthlyAttendance(instituteId, academicSessionId, classId, sectionId, month, teacherId);
    }

    @GetMapping("/teachers/me/targets")
    public List<TeacherAttendanceTargetResponse> getMyTeacherAttendanceTargets(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam Long academicSessionId
    ) {
        return attendanceService.getTeacherAttendanceTargets(principal.instituteId(), principal.teacherId(), academicSessionId);
    }

    @GetMapping("/students/me")
    public List<AttendanceResponse> getMyStudentAttendance(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam String month
    ) {
        return attendanceService.getStudentAttendanceMonth(principal.instituteId(), principal.studentId(), month);
    }

    @GetMapping("/teachers/daily")
    public List<TeacherAttendanceResponse> getTeacherAttendanceForDate(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam String date
    ) {
        return attendanceService.getTeacherAttendanceForDate(instituteId, date);
    }

    @GetMapping("/teachers/monthly")
    public TeacherAttendanceMonthResponse getTeacherAttendanceForMonth(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam String month
    ) {
        return attendanceService.getTeacherAttendanceForMonth(instituteId, month);
    }

    @PostMapping("/teachers")
    @ResponseStatus(HttpStatus.CREATED)
    public List<TeacherAttendanceResponse> saveTeacherAttendance(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody TeacherAttendanceSaveRequest request
    ) {
        return attendanceService.saveTeacherAttendance(principal.instituteId(), principal.accountId(), request);
    }
}
