package com.erp.backend.transport.controller;

import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.transport.dto.TransportAssignmentPayload;
import com.erp.backend.transport.dto.TransportAssignmentResponse;
import com.erp.backend.transport.dto.TransportAttendanceResponse;
import com.erp.backend.transport.dto.TransportAttendanceSaveRequest;
import com.erp.backend.transport.dto.TransportDriverPayload;
import com.erp.backend.transport.dto.TransportDriverResponse;
import com.erp.backend.transport.dto.TransportOverviewResponse;
import com.erp.backend.transport.dto.TransportRouteOperationResponse;
import com.erp.backend.transport.dto.TransportStudentLookupResponse;
import com.erp.backend.transport.service.TransportService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/transport")
public class TransportController {

    private final TransportService transportService;

    public TransportController(TransportService transportService) {
        this.transportService = transportService;
    }

    @GetMapping("/overview")
    public TransportOverviewResponse getOverview(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) String date
    ) {
        return transportService.getOverview(instituteId, date);
    }

    @GetMapping("/drivers")
    public List<TransportDriverResponse> getDrivers(@AuthenticationPrincipal(expression = "instituteId") Long instituteId) {
        return transportService.getDrivers(instituteId);
    }

    @GetMapping("/route-operations")
    public List<TransportRouteOperationResponse> getRouteOperations(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) String date
    ) {
        return transportService.getRouteOperations(instituteId, academicSessionId, date);
    }

    @PostMapping("/drivers")
    @ResponseStatus(HttpStatus.CREATED)
    public TransportDriverResponse saveDriver(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody TransportDriverPayload request
    ) {
        return transportService.saveDriver(instituteId, request);
    }

    @DeleteMapping("/drivers/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDriver(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        transportService.deleteDriver(instituteId, id);
    }

    @GetMapping("/assignments")
    public List<TransportAssignmentResponse> getAssignments(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return transportService.getAssignments(instituteId, academicSessionId);
    }

    @GetMapping("/drivers/{id}/assignments")
    public List<TransportAssignmentResponse> getDriverAssignments(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return transportService.getDriverAssignments(instituteId, id, academicSessionId);
    }

    @GetMapping("/routes/{id}/assignments")
    public List<TransportAssignmentResponse> getRouteAssignments(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return transportService.getRouteAssignments(instituteId, id, academicSessionId);
    }

    @GetMapping("/students/lookup")
    public TransportStudentLookupResponse lookupStudent(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam String enrollmentNo
    ) {
        return transportService.lookupStudent(instituteId, enrollmentNo);
    }

    @GetMapping("/student/me")
    public ResponseEntity<TransportAssignmentResponse> getMyTransportAssignment(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return transportService.getStudentAssignment(principal.instituteId(), principal.studentId(), academicSessionId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/student/me/attendance")
    public List<TransportAttendanceResponse> getMyTransportAttendance(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam String month
    ) {
        return transportService.getStudentMonthlyAttendance(principal.instituteId(), principal.studentId(), month);
    }

    @PostMapping("/assignments")
    @ResponseStatus(HttpStatus.CREATED)
    public TransportAssignmentResponse saveAssignment(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody TransportAssignmentPayload request
    ) {
        return transportService.saveAssignment(instituteId, request);
    }

    @DeleteMapping("/assignments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAssignment(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        transportService.deleteAssignment(instituteId, id);
    }

    @GetMapping("/attendance")
    @Deprecated
    public List<TransportAttendanceResponse> getAttendance(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long driverId
    ) {
        return transportService.getAttendance(instituteId, driverId);
    }

    @GetMapping("/drivers/{id}/attendance/daily")
    public List<TransportAttendanceResponse> getDailyAttendance(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @RequestParam String date
    ) {
        return transportService.getDailyAttendance(instituteId, id, date);
    }

    @GetMapping("/drivers/{id}/attendance/monthly")
    public List<TransportAttendanceResponse> getMonthlyAttendance(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @RequestParam String month
    ) {
        return transportService.getMonthlyAttendance(instituteId, id, month);
    }

    @GetMapping("/routes/{id}/attendance/daily")
    public List<TransportAttendanceResponse> getRouteDailyAttendance(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @RequestParam String date
    ) {
        return transportService.getRouteDailyAttendance(instituteId, id, date);
    }

    @GetMapping("/routes/{id}/attendance/monthly")
    public List<TransportAttendanceResponse> getRouteMonthlyAttendance(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @RequestParam String month
    ) {
        return transportService.getRouteMonthlyAttendance(instituteId, id, month);
    }

    @PostMapping("/attendance")
    @ResponseStatus(HttpStatus.CREATED)
    public List<TransportAttendanceResponse> saveAttendance(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody TransportAttendanceSaveRequest request
    ) {
        return transportService.saveAttendance(principal.instituteId(), principal.accountId(), request);
    }

    @PatchMapping("/drivers/{id}/status")
    public TransportDriverResponse updateDriverStatus(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @RequestParam String status
    ) {
        return transportService.updateDriverStatus(instituteId, id, status);
    }
}
