package com.erp.backend.notice.controller;

import java.util.List;

import com.erp.backend.notice.dto.NoticePayload;
import com.erp.backend.notice.dto.NoticeResponse;
import com.erp.backend.notice.service.NoticeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notices")
public class NoticeController {

    private final NoticeService noticeService;

    public NoticeController(NoticeService noticeService) {
        this.noticeService = noticeService;
    }

    @GetMapping
    public List<NoticeResponse> getNotices(@RequestHeader("X-Institute-Id") Long instituteId) {
        return noticeService.getNotices(instituteId);
    }

    @GetMapping("/portal")
    public List<NoticeResponse> getPortalNotices(@RequestHeader("X-Institute-Id") Long instituteId) {
        return noticeService.getPortalNotices(instituteId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NoticeResponse createNotice(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody NoticePayload request
    ) {
        return noticeService.createNotice(instituteId, request);
    }

    @PutMapping("/{id}")
    public NoticeResponse updateNotice(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id,
            @Valid @RequestBody NoticePayload request
    ) {
        return noticeService.updateNotice(instituteId, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNotice(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        noticeService.deleteNotice(instituteId, id);
    }
}
