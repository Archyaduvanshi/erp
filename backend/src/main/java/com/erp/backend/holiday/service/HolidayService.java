package com.erp.backend.holiday.service;

import java.util.List;
import java.util.stream.Collectors;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.holiday.dto.HolidayPayload;
import com.erp.backend.holiday.dto.HolidayResponse;
import com.erp.backend.holiday.entity.Holiday;
import com.erp.backend.holiday.repository.HolidayRepository;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class HolidayService {

    private final InstituteRepository instituteRepository;
    private final HolidayRepository holidayRepository;

    public HolidayService(
            InstituteRepository instituteRepository,
            HolidayRepository holidayRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.holidayRepository = holidayRepository;
    }

    public List<HolidayResponse> getHolidays(Long instituteId) {
        validateInstitute(instituteId);
        return holidayRepository.findAllByInstituteIdOrderByHolidayDateAsc(instituteId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public HolidayResponse createHoliday(Long instituteId, HolidayPayload request) {
        Institute institute = validateInstitute(instituteId);
        Holiday holiday = new Holiday();
        holiday.setInstitute(institute);
        applyPayload(holiday, request);
        Holiday savedHoliday = holidayRepository.save(holiday);
        return toResponse(savedHoliday);
    }

    @Transactional
    public void deleteHoliday(Long instituteId, Long id) {
        Holiday holiday = holidayRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Holiday not found with id: " + id));
        holidayRepository.delete(holiday);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private void applyPayload(Holiday holiday, HolidayPayload request) {
        holiday.setTitle(requiredTrim(request.title(), "Holiday name is required."));
        holiday.setHolidayDate(request.holidayDate());
        holiday.setHolidayType(defaultValue(request.holidayType(), "Public Holiday"));
        holiday.setAudience(normalizeAudience(request.audience()));
        holiday.setTargetClasses(joinTargetClasses(request.targetClasses(), holiday.getAudience()));
        holiday.setNotes(trim(request.notes()));
    }

    private HolidayResponse toResponse(Holiday holiday) {
        return new HolidayResponse(
                holiday.getId(),
                holiday.getTitle(),
                holiday.getHolidayDate(),
                holiday.getHolidayType(),
                holiday.getAudience(),
                parseTargetClasses(holiday.getTargetClasses()),
                holiday.getNotes(),
                holiday.getCreatedAt(),
                holiday.getUpdatedAt()
        );
    }

    private String normalizeAudience(String value) {
        String audience = defaultValue(value, "All");
        if (audience.equalsIgnoreCase("Student") || audience.equalsIgnoreCase("Students")) return "Students";
        if (audience.equalsIgnoreCase("Teacher") || audience.equalsIgnoreCase("Teachers")) return "Teachers";
        return "All";
    }

    private String joinTargetClasses(List<String> values, String audience) {
        if (!"Students".equalsIgnoreCase(audience)) {
            return "All";
        }
        if (values == null || values.isEmpty()) {
            return "All";
        }

        List<String> normalized = values.stream()
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
}
