package com.erp.backend.notice.service;

import java.util.List;
import java.util.stream.Collectors;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.notice.dto.NoticePayload;
import com.erp.backend.notice.dto.NoticeResponse;
import com.erp.backend.notice.entity.Notice;
import com.erp.backend.notice.repository.NoticeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class NoticeService {

    private final InstituteRepository instituteRepository;
    private final NoticeRepository noticeRepository;

    public NoticeService(InstituteRepository instituteRepository, NoticeRepository noticeRepository) {
        this.instituteRepository = instituteRepository;
        this.noticeRepository = noticeRepository;
    }

    public List<NoticeResponse> getNotices(Long instituteId) {
        validateInstitute(instituteId);
        return noticeRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .filter(notice -> !"HOLIDAY".equalsIgnoreCase(notice.getSourceType()))
                .filter(notice -> notice.getTargetStudentId() == null && notice.getTargetTeacherId() == null)
                .map(this::toResponse)
                .toList();
    }

    public List<NoticeResponse> getPortalNotices(Long instituteId) {
        validateInstitute(instituteId);
        return noticeRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public NoticeResponse createNotice(Long instituteId, NoticePayload request) {
        Institute institute = validateInstitute(instituteId);
        Notice notice = new Notice();
        notice.setInstitute(institute);
        applyPayload(notice, request);
        return toResponse(noticeRepository.save(notice));
    }

    @Transactional
    public NoticeResponse updateNotice(Long instituteId, Long id, NoticePayload request) {
        Notice notice = noticeRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Notice not found with id: " + id));
        applyPayload(notice, request);
        notice.setSourceType(null);
        notice.setSourceId(null);
        return toResponse(noticeRepository.save(notice));
    }

    @Transactional
    public void deleteNotice(Long instituteId, Long id) {
        Notice notice = noticeRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Notice not found with id: " + id));
        noticeRepository.delete(notice);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private void applyPayload(Notice notice, NoticePayload request) {
        notice.setTitle(requiredTrim(request.title(), "Notice title is required."));
        notice.setCategory(defaultValue(request.category(), "General"));
        notice.setAudience(normalizeAudience(request.audience()));
        notice.setTargetClasses(joinTargetClasses(request.targetClasses(), notice.getAudience()));
        notice.setTargetStudentId(request.targetStudentId());
        notice.setTargetTeacherId(request.targetTeacherId());
        notice.setPriority(defaultValue(request.priority(), "Normal"));
        notice.setPublishDate(request.publishDate());
        notice.setExpireDate(request.expireDate());
        notice.setStatus(normalizeStatus(request.status()));
        notice.setPinned(Boolean.TRUE.equals(request.isPinned()));
        notice.setSummary(requiredTrim(request.summary(), "Summary is required."));
        notice.setDetails(requiredTrim(request.details(), "Details are required."));
    }

    private NoticeResponse toResponse(Notice notice) {
        return new NoticeResponse(
                notice.getId(),
                notice.getTitle(),
                notice.getCategory(),
                notice.getAudience(),
                parseTargetClasses(notice.getTargetClasses()),
                notice.getTargetStudentId(),
                notice.getTargetTeacherId(),
                notice.getPriority(),
                notice.getPublishDate(),
                notice.getExpireDate(),
                notice.getStatus(),
                Boolean.TRUE.equals(notice.getPinned()),
                notice.getSummary(),
                notice.getDetails(),
                notice.getSourceType(),
                notice.getSourceId(),
                notice.getCreatedAt(),
                notice.getUpdatedAt()
        );
    }

    private String normalizeAudience(String value) {
        String audience = defaultValue(value, "All");
        if (audience.equalsIgnoreCase("Student") || audience.equalsIgnoreCase("Students")) return "Students";
        if (audience.equalsIgnoreCase("Teacher") || audience.equalsIgnoreCase("Teachers")) return "Teachers";
        return "All";
    }

    private String joinTargetClasses(List<String> values, String audience) {
        return normalizeTargetClasses(values, audience).stream().collect(Collectors.joining(","));
    }

    private List<String> normalizeTargetClasses(List<String> values, String audience) {
        if (!"Students".equalsIgnoreCase(audience)) {
            return List.of("All");
        }
        if (values == null || values.isEmpty()) {
            return List.of("All");
        }

        List<String> normalized = values.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList();

        if (normalized.isEmpty() || normalized.stream().anyMatch(value -> value.equalsIgnoreCase("All"))) {
            return List.of("All");
        }

        return normalized;
    }

    private List<String> parseTargetClasses(String value) {
        if (!StringUtils.hasText(value)) {
            return List.of("All");
        }

        return List.of(value.split(","))
                .stream()
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
    }

    private String normalizeStatus(String value) {
        String status = defaultValue(value, "Draft");
        if (status.equalsIgnoreCase("Published")) return "Published";
        if (status.equalsIgnoreCase("Archived")) return "Archived";
        return "Draft";
    }

    private String requiredTrim(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }
}
