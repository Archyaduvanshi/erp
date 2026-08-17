package com.erp.backend.hostel.controller;

import java.util.List;

import com.erp.backend.hostel.dto.HostelOverviewResponse;
import com.erp.backend.hostel.dto.HostelPayload;
import com.erp.backend.hostel.dto.HostelResidentPayload;
import com.erp.backend.hostel.dto.HostelResidentResponse;
import com.erp.backend.hostel.dto.HostelResponse;
import com.erp.backend.hostel.dto.HostelRoomPayload;
import com.erp.backend.hostel.dto.HostelRoomResponse;
import com.erp.backend.hostel.service.HostelService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
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
    public HostelOverviewResponse getOverview(@RequestHeader("X-Institute-Id") Long instituteId) {
        return hostelService.getOverview(instituteId);
    }

    @GetMapping
    public List<HostelResponse> getHostels(@RequestHeader("X-Institute-Id") Long instituteId) {
        return hostelService.getHostels(instituteId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HostelResponse saveHostel(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody HostelPayload request
    ) {
        return hostelService.saveHostel(instituteId, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHostel(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        hostelService.deleteHostel(instituteId, id);
    }

    @GetMapping("/rooms")
    public List<HostelRoomResponse> getRooms(@RequestHeader("X-Institute-Id") Long instituteId) {
        return hostelService.getRooms(instituteId);
    }

    @PostMapping("/rooms")
    @ResponseStatus(HttpStatus.CREATED)
    public HostelRoomResponse saveRoom(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody HostelRoomPayload request
    ) {
        return hostelService.saveRoom(instituteId, request);
    }

    @PostMapping("/rooms/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public List<HostelRoomResponse> saveRooms(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody List<@Valid HostelRoomPayload> requests
    ) {
        return hostelService.saveRooms(instituteId, requests);
    }

    @DeleteMapping("/rooms/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRoom(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        hostelService.deleteRoom(instituteId, id);
    }

    @GetMapping("/residents")
    public List<HostelResidentResponse> getResidents(@RequestHeader("X-Institute-Id") Long instituteId) {
        return hostelService.getResidents(instituteId);
    }

    @PostMapping("/residents")
    @ResponseStatus(HttpStatus.CREATED)
    public HostelResidentResponse saveResident(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody HostelResidentPayload request
    ) {
        return hostelService.saveResident(instituteId, request);
    }

    @PatchMapping("/residents/{id}/vacate")
    public HostelResidentResponse vacateResident(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        return hostelService.vacateResident(instituteId, id);
    }

    @DeleteMapping("/residents/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteResident(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        hostelService.deleteResident(instituteId, id);
    }
}
