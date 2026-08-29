package com.erp.backend.holiday.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.repository.SchoolClassRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.holiday.dto.HolidayPayload;
import com.erp.backend.holiday.dto.HolidayResponse;
import com.erp.backend.holiday.dto.HolidayTargetClassResponse;
import com.erp.backend.holiday.entity.Holiday;
import com.erp.backend.holiday.entity.HolidayTargetClass;
import com.erp.backend.holiday.repository.HolidayRepository;
import com.erp.backend.holiday.repository.HolidayTargetClassRepository;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.notice.dto.NoticePayload;
import com.erp.backend.notice.service.NoticeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class HolidayService {

    private static final String HOLIDAY_SOURCE_TYPE = "HOLIDAY";

    private final InstituteRepository instituteRepository;
    private final SchoolClassRepository schoolClassRepository;
    private final HolidayRepository holidayRepository;
    private final HolidayTargetClassRepository holidayTargetClassRepository;
    private final NoticeService noticeService;

    public HolidayService(
            InstituteRepository instituteRepository,
            SchoolClassRepository schoolClassRepository,
            HolidayRepository holidayRepository,
            HolidayTargetClassRepository holidayTargetClassRepository,
            NoticeService noticeService
    ) {
        this.instituteRepository = instituteRepository;
        this.schoolClassRepository = schoolClassRepository;
        this.holidayRepository = holidayRepository;
        this.holidayTargetClassRepository = holidayTargetClassRepository;
        this.noticeService = noticeService;
    }

    @Transactional(readOnly = true)
    public List<HolidayResponse> getHolidays(Long instituteId, String from, String to) {
        validateInstitute(instituteId);
        LocalDate fromDate = parseDate(from);
        LocalDate toDate = parseDate(to);
        List<Holiday> holidays = fromDate != null && toDate != null
                ? holidayRepository.findAllWithTargetsInRange(instituteId, fromDate, toDate)
                : holidayRepository.findAllWithTargets(instituteId);
        return holidays.stream()
                .map(holiday -> toResponse(holiday, holiday.getTargetClassMappings()))
                .toList();
    }

    @Transactional
    public HolidayResponse createHoliday(Long instituteId, HolidayPayload request) {
        Institute institute = validateInstitute(instituteId);
        List<SchoolClass> targetClasses = validateTargetClasses(instituteId, request);
        Holiday holiday = new Holiday();
        holiday.setInstitute(institute);
        applyPayload(holiday, request, targetClasses);
        Holiday savedHoliday = holidayRepository.save(holiday);
        replaceTargetClasses(savedHoliday, targetClasses);
        saveHolidayNotice(savedHoliday, targetClasses);
        return toResponseFromClasses(savedHoliday, targetClasses);
    }

    @Transactional
    public HolidayResponse updateHoliday(Long instituteId, Long id, HolidayPayload request) {
        Holiday holiday = holidayRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Holiday not found with id: " + id));
        List<SchoolClass> targetClasses = validateTargetClasses(instituteId, request);
        applyPayload(holiday, request, targetClasses);
        Holiday savedHoliday = holidayRepository.save(holiday);
        replaceTargetClasses(savedHoliday, targetClasses);
        saveHolidayNotice(savedHoliday, targetClasses);
        return toResponseFromClasses(savedHoliday, targetClasses);
    }

    @Transactional
    public void deleteHoliday(Long instituteId, Long id) {
        Holiday holiday = holidayRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Holiday not found with id: " + id));
        noticeService.archiveSystemNotice(instituteId, HOLIDAY_SOURCE_TYPE, id, null);
        holidayTargetClassRepository.deleteAllByHolidayId(id);
        holidayRepository.delete(holiday);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private void applyPayload(Holiday holiday, HolidayPayload request, List<SchoolClass> targetClasses) {
        holiday.setTitle(requiredTrim(request.title(), "Holiday name is required."));
        holiday.setHolidayDate(request.holidayDate());
        holiday.setHolidayType(defaultValue(request.holidayType(), "Public Holiday"));
        holiday.setAudience(normalizeAudience(request.audience()));
        holiday.setTargetClasses(joinTargetClasses(request.targetClasses(), holiday.getAudience(), targetClasses));
        holiday.setNotes(trim(request.notes()));
    }

    private void replaceTargetClasses(Holiday holiday, List<SchoolClass> targetClasses) {
        holidayTargetClassRepository.deleteAllByHolidayId(holiday.getId());
        if (!"Students".equalsIgnoreCase(holiday.getAudience()) || targetClasses.isEmpty()) {
            return;
        }

        List<HolidayTargetClass> targets = targetClasses.stream()
                .map(schoolClass -> {
                    HolidayTargetClass target = new HolidayTargetClass();
                    target.setHoliday(holiday);
                    target.setSchoolClass(schoolClass);
                    return target;
                })
                .toList();
        holidayTargetClassRepository.saveAll(targets);
    }

    private void saveHolidayNotice(Holiday holiday, List<SchoolClass> targetClasses) {
        noticeService.upsertSystemNotice(
                        holiday.getInstitute().getId(),
                        HOLIDAY_SOURCE_TYPE,
                        holiday.getId(),
                        new NoticePayload(
                                "Holiday: " + holiday.getTitle(),
                                "Holiday",
                                holiday.getAudience(),
                                targetClasses.stream().map(SchoolClass::getName).toList(),
                                targetClasses.stream().map(SchoolClass::getId).toList(),
                                null,
                                null,
                                "Normal",
                                LocalDate.now(),
                                null,
                                "Published",
                                false,
                                holiday.getTitle() + " has been added to the college holiday calendar.",
                                buildHolidayNoticeDetails(holiday, targetClasses)
                        )
                );
    }

    private String buildHolidayNoticeDetails(Holiday holiday, List<SchoolClass> targetClasses) {
        String audience = holiday.getAudience();
        String targetClassLine = "Students".equalsIgnoreCase(audience)
                ? "\nClasses: " + joinTargetClasses(null, audience, targetClasses)
                : "";
        String notes = StringUtils.hasText(holiday.getNotes()) ? "\n\nNotes: " + holiday.getNotes().trim() : "";
        return "The college has declared " + holiday.getTitle()
                + " on " + holiday.getHolidayDate()
                + ".\n\nType: " + holiday.getHolidayType()
                + "\nAudience: " + audience
                + targetClassLine
                + notes;
    }

    private HolidayResponse toResponse(Holiday holiday, List<HolidayTargetClass> targetClasses) {
        List<SchoolClass> schoolClasses = targetClasses.stream()
                .map(HolidayTargetClass::getSchoolClass)
                .sorted(Comparator.comparing(SchoolClass::getName, String::compareToIgnoreCase))
                .toList();
        return toResponseFromClasses(holiday, schoolClasses);
    }

    private HolidayResponse toResponseFromClasses(Holiday holiday, List<SchoolClass> targetClasses) {
        List<HolidayTargetClassResponse> targetClassTargets = targetClasses.stream()
                .map(schoolClass -> new HolidayTargetClassResponse(schoolClass.getId(), schoolClass.getName()))
                .toList();
        List<Long> targetClassIds = targetClasses.stream()
                .map(SchoolClass::getId)
                .toList();
        List<String> targetClassLabels = targetClasses.stream().map(SchoolClass::getName).toList();
        return new HolidayResponse(
                holiday.getId(),
                holiday.getTitle(),
                holiday.getHolidayDate(),
                holiday.getHolidayType(),
                holiday.getAudience(),
                targetClassIds,
                targetClassTargets,
                targetClassLabels,
                holiday.getNotes(),
                holiday.getCreatedAt(),
                holiday.getUpdatedAt()
        );
    }

    private String normalizeAudience(String value) {
        String audience = defaultValue(value, "All");
        if (audience.equalsIgnoreCase("Student") || audience.equalsIgnoreCase("Students")) return "Students";
        if (audience.equalsIgnoreCase("Teacher") || audience.equalsIgnoreCase("Teachers")) return "Teachers";
        if (audience.equalsIgnoreCase("All")) return "All";
        throw new IllegalArgumentException("UNSUPPORTED_NOTICE_AUDIENCE");
    }

    private List<SchoolClass> validateTargetClasses(Long instituteId, HolidayPayload request) {
        String audience = normalizeAudience(request.audience());
        if (!"Students".equalsIgnoreCase(audience)) {
            return List.of();
        }

        List<Long> ids = request.targetClassIds() == null ? List.of() : request.targetClassIds().stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .toList();

        if (ids.isEmpty()) {
            return List.of();
        }

        Set<Long> requestedIds = new java.util.LinkedHashSet<>(ids);
        Map<Long, SchoolClass> classesById = schoolClassRepository.findAllByInstituteIdAndIdIn(instituteId, requestedIds)
                .stream()
                .collect(Collectors.toMap(SchoolClass::getId, schoolClass -> schoolClass));

        List<Long> missingIds = ids.stream()
                .filter(id -> !classesById.containsKey(id))
                .toList();
        if (!missingIds.isEmpty()) {
            throw new IllegalArgumentException("Invalid target class id(s): " + missingIds.stream()
                    .map(String::valueOf)
                    .collect(Collectors.joining(", ")));
        }

        List<Long> archivedIds = ids.stream()
                .filter(id -> "ARCHIVED".equalsIgnoreCase(classesById.get(id).getStatus()))
                .toList();
        if (!archivedIds.isEmpty()) {
            throw new IllegalArgumentException("Archived target class id(s) are not allowed: " + archivedIds.stream()
                    .map(String::valueOf)
                    .collect(Collectors.joining(", ")));
        }

        return ids.stream()
                .map(classesById::get)
                .toList();
    }

    private String joinTargetClasses(List<String> legacyValues, String audience, List<SchoolClass> targetClasses) {
        if (!"Students".equalsIgnoreCase(audience)) {
            return "All";
        }
        if (targetClasses != null && !targetClasses.isEmpty()) {
            return targetClasses.stream()
                    .map(SchoolClass::getName)
                    .distinct()
                    .collect(Collectors.joining(","));
        }
        if (legacyValues == null || legacyValues.isEmpty()) {
            return "All";
        }

        List<String> normalized = legacyValues.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList();

        if (normalized.isEmpty() || normalized.stream().anyMatch(value -> value.equalsIgnoreCase("All"))) {
            return "All";
        }

        return normalized.stream().collect(Collectors.joining(","));
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

    private String requiredTrim(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private LocalDate parseDate(String value) {
        return StringUtils.hasText(value) ? LocalDate.parse(value.trim()) : null;
    }
}
