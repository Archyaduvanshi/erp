package com.erp.backend.notice.controller;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.notice.dto.NoticeListResponse;
import com.erp.backend.notice.dto.NoticeOverviewResponse;
import com.erp.backend.notice.dto.NoticePayload;
import com.erp.backend.notice.dto.NoticeResponse;
import com.erp.backend.notice.dto.PortalNoticeResponse;
import com.erp.backend.notice.dto.PortalNoticeOverviewResponse;
import com.erp.backend.notice.service.NoticeService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/notices")
public class NoticeController {

    private final NoticeService noticeService;

    public NoticeController(NoticeService noticeService) {
        this.noticeService = noticeService;
    }

    @GetMapping
    public Page<NoticeListResponse> getNotices(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String audience,
            @RequestParam(defaultValue = "") String priority,
            @RequestParam(defaultValue = "") String category
    ) {
        return noticeService.getNotices(instituteId, page, size, search, status, audience, priority, category);
    }

    @GetMapping("/overview")
    public NoticeOverviewResponse getOverview(@AuthenticationPrincipal(expression = "instituteId") Long instituteId) {
        return noticeService.getOverview(instituteId);
    }

    @GetMapping("/{id}")
    public NoticeResponse getNotice(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        return noticeService.getNotice(instituteId, id);
    }

    @GetMapping("/portal")
    public Page<PortalNoticeResponse> getPortalNotices(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String priority
    ) {
        return noticeService.getPortalNotices(principal, page, size, search, priority);
    }

    @GetMapping("/portal/overview")
    public PortalNoticeOverviewResponse getPortalOverview(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String priority
    ) {
        return noticeService.getPortalOverview(principal, search, priority);
    }

    @GetMapping("/portal/{id}")
    public NoticeResponse getPortalNotice(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id
    ) {
        return noticeService.getPortalNotice(principal, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NoticeResponse createNotice(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody NoticePayload request
    ) {
        return noticeService.createNotice(principal.instituteId(), principal.accountId(), request);
    }

    @PutMapping("/{id}")
    public NoticeResponse updateNotice(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody NoticePayload request
    ) {
        return noticeService.updateNotice(principal.instituteId(), principal.accountId(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNotice(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id
    ) {
        noticeService.deleteNotice(principal.instituteId(), principal.accountId(), id);
    }
}
