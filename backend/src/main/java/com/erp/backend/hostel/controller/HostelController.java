package com.erp.backend.hostel.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.hostel.dto.HostelMessMenuPayload;
import com.erp.backend.hostel.dto.HostelMessSummaryResponse;
import com.erp.backend.hostel.dto.HostelOverviewResponse;
import com.erp.backend.hostel.dto.HostelPayload;
import com.erp.backend.hostel.dto.HostelResidentPayload;
import com.erp.backend.hostel.dto.HostelResidentResponse;
import com.erp.backend.hostel.dto.HostelResponse;
import com.erp.backend.hostel.dto.HostelRoomPayload;
import com.erp.backend.hostel.dto.HostelRoomResponse;
import com.erp.backend.hostel.dto.HostelStudentLookupResponse;
import com.erp.backend.hostel.dto.HostelStudentMeResponse;
import com.erp.backend.hostel.dto.HostelStudentSearchResponse;
import com.erp.backend.hostel.service.HostelService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/hostel")
public class HostelController {

    private final HostelService hostelService;

    public HostelController(HostelService hostelService) {
        this.hostelService = hostelService;
    }

    @GetMapping("/overview")
    public HostelOverviewResponse getOverview(@AuthenticationPrincipal(expression = "instituteId") Long instituteId) {
        return hostelService.getOverview(instituteId);
    }

    @GetMapping
    public List<HostelResponse> getHostels(@AuthenticationPrincipal(expression = "instituteId") Long instituteId) {
        return hostelService.getHostels(instituteId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HostelResponse saveHostel(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody HostelPayload request
    ) {
        return hostelService.saveHostel(instituteId, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHostel(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        hostelService.deleteHostel(instituteId, id);
    }

    @GetMapping("/rooms")
    public List<HostelRoomResponse> getRooms(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long hostelId,
            @RequestParam(defaultValue = "") String floor,
            @RequestParam(defaultValue = "") String status
    ) {
        return hostelService.getRooms(instituteId, hostelId, floor, status);
    }

    @GetMapping("/{hostelId}/rooms")
    public List<HostelRoomResponse> getHostelRooms(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long hostelId,
            @RequestParam(defaultValue = "") String floor,
            @RequestParam(defaultValue = "") String status
    ) {
        return hostelService.getRooms(instituteId, hostelId, floor, status);
    }

    @PostMapping("/rooms")
    @ResponseStatus(HttpStatus.CREATED)
    public HostelRoomResponse saveRoom(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody HostelRoomPayload request
    ) {
        return hostelService.saveRoom(instituteId, request);
    }

    @PutMapping("/rooms/{id}")
    public HostelRoomResponse updateRoom(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @Valid @RequestBody HostelRoomPayload request
    ) {
        return hostelService.updateRoom(instituteId, id, request);
    }

    @PostMapping("/rooms/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public List<HostelRoomResponse> saveRooms(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody List<@Valid HostelRoomPayload> requests
    ) {
        return hostelService.saveRooms(instituteId, requests);
    }

    @DeleteMapping("/rooms/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRoom(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        hostelService.deleteRoom(instituteId, id);
    }

    @GetMapping("/residents")
    public Page<HostelResidentResponse> getResidents(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long hostelId,
            @RequestParam(required = false) Long roomId,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return hostelService.getResidents(instituteId, hostelId, roomId, status, search, PageRequest.of(Math.max(page, 0), clampSize(size)));
    }

    @GetMapping("/student/me")
    public HostelStudentMeResponse getMyResident(@AuthenticationPrincipal AuthPrincipal principal) {
        return hostelService.getStudentHostelDetails(principal.instituteId(), principal.studentId());
    }

    @GetMapping("/rooms/{roomId}/residents")
    public Page<HostelResidentResponse> getRoomResidents(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long roomId,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return hostelService.getResidents(instituteId, null, roomId, status, "", PageRequest.of(Math.max(page, 0), clampSize(size)));
    }

    @GetMapping("/students/lookup")
    public HostelStudentLookupResponse lookupStudent(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam String enrollmentNo
    ) {
        return hostelService.lookupStudent(instituteId, enrollmentNo);
    }

    @GetMapping("/students/search")
    public Page<HostelStudentSearchResponse> searchStudents(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String className,
            @RequestParam(defaultValue = "") String section,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return hostelService.searchStudents(instituteId, search, className, section, PageRequest.of(Math.max(page, 0), clampSize(size)));
    }

    @PostMapping("/residents")
    @ResponseStatus(HttpStatus.CREATED)
    public HostelResidentResponse saveResident(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody HostelResidentPayload request
    ) {
        return hostelService.saveResident(instituteId, request);
    }

    @PatchMapping("/residents/{id}/vacate")
    public HostelResidentResponse vacateResident(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        return hostelService.vacateResident(instituteId, id);
    }

    @DeleteMapping("/residents/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteResident(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        hostelService.deleteResident(instituteId, id);
    }

    @GetMapping("/{hostelId}/mess-menu")
    public HostelMessMenuPayload getMessMenu(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long hostelId
    ) {
        return hostelService.getMessMenu(instituteId, hostelId);
    }

    @PutMapping("/{hostelId}/mess-menu")
    public HostelMessMenuPayload saveMessMenu(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long hostelId,
            @RequestBody HostelMessMenuPayload payload
    ) {
        return hostelService.saveMessMenu(instituteId, hostelId, payload);
    }

    @GetMapping("/{hostelId}/mess-summary")
    public HostelMessSummaryResponse getMessSummary(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long hostelId
    ) {
        return hostelService.getMessSummary(instituteId, hostelId);
    }

    private int clampSize(int size) {
        if (size <= 25) return 25;
        if (size <= 50) return 50;
        return 100;
    }
}
