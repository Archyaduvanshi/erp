package com.erp.backend.attendance.controller;

import java.util.List;

import com.erp.backend.attendance.dto.AttendanceResponse;
import com.erp.backend.attendance.dto.AttendanceSaveRequest;
import com.erp.backend.attendance.service.AttendanceService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
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

    @GetMapping
    public List<AttendanceResponse> getAttendance(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @RequestParam(required = false) String className
    ) {
        return attendanceService.getAttendance(instituteId, className);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public List<AttendanceResponse> saveAttendance(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody AttendanceSaveRequest request
    ) {
        return attendanceService.saveAttendance(instituteId, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAttendance(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        attendanceService.deleteAttendance(instituteId, id);
    }
}
