package com.erp.backend.transport.controller;

import java.util.List;

import com.erp.backend.transport.dto.TransportAssignmentPayload;
import com.erp.backend.transport.dto.TransportAssignmentResponse;
import com.erp.backend.transport.dto.TransportAttendanceResponse;
import com.erp.backend.transport.dto.TransportAttendanceSaveRequest;
import com.erp.backend.transport.dto.TransportDriverPayload;
import com.erp.backend.transport.dto.TransportDriverResponse;
import com.erp.backend.transport.service.TransportService;
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
@RequestMapping("/api/transport")
public class TransportController {

    private final TransportService transportService;

    public TransportController(TransportService transportService) {
        this.transportService = transportService;
    }

    @GetMapping("/drivers")
    public List<TransportDriverResponse> getDrivers(@RequestHeader("X-Institute-Id") Long instituteId) {
        return transportService.getDrivers(instituteId);
    }

    @PostMapping("/drivers")
    @ResponseStatus(HttpStatus.CREATED)
    public TransportDriverResponse saveDriver(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody TransportDriverPayload request
    ) {
        return transportService.saveDriver(instituteId, request);
    }

    @DeleteMapping("/drivers/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDriver(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        transportService.deleteDriver(instituteId, id);
    }

    @GetMapping("/assignments")
    public List<TransportAssignmentResponse> getAssignments(@RequestHeader("X-Institute-Id") Long instituteId) {
        return transportService.getAssignments(instituteId);
    }

    @PostMapping("/assignments")
    @ResponseStatus(HttpStatus.CREATED)
    public TransportAssignmentResponse saveAssignment(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody TransportAssignmentPayload request
    ) {
        return transportService.saveAssignment(instituteId, request);
    }

    @DeleteMapping("/assignments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAssignment(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        transportService.deleteAssignment(instituteId, id);
    }

    @GetMapping("/attendance")
    public List<TransportAttendanceResponse> getAttendance(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @RequestParam(required = false) Long driverId
    ) {
        return transportService.getAttendance(instituteId, driverId);
    }

    @PostMapping("/attendance")
    @ResponseStatus(HttpStatus.CREATED)
    public List<TransportAttendanceResponse> saveAttendance(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody TransportAttendanceSaveRequest request
    ) {
        return transportService.saveAttendance(instituteId, request);
    }
}
