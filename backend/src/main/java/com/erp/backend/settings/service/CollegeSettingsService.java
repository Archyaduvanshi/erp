package com.erp.backend.settings.service;

import java.util.List;
import java.util.Map;

import com.erp.backend.exception.FieldValidationException;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.settings.dto.CollegeSettingsResponse;
import com.erp.backend.settings.dto.FeatureAccessPayload;
import com.erp.backend.settings.dto.FeatureAccessResponse;
import com.erp.backend.settings.dto.FeatureLoginRequest;
import com.erp.backend.settings.dto.FeatureLoginResponse;
import com.erp.backend.settings.dto.NotificationsPayload;
import com.erp.backend.settings.dto.PreferencesPayload;
import com.erp.backend.settings.entity.CollegeSettings;
import com.erp.backend.settings.entity.FeatureAccess;
import com.erp.backend.settings.repository.CollegeSettingsRepository;
import com.erp.backend.settings.repository.FeatureAccessRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class CollegeSettingsService {

    private final InstituteRepository instituteRepository;
    private final CollegeSettingsRepository collegeSettingsRepository;
    private final FeatureAccessRepository featureAccessRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public CollegeSettingsService(
            InstituteRepository instituteRepository,
            CollegeSettingsRepository collegeSettingsRepository,
            FeatureAccessRepository featureAccessRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.collegeSettingsRepository = collegeSettingsRepository;
        this.featureAccessRepository = featureAccessRepository;
    }

    public CollegeSettingsResponse getSettings(Long instituteId) {
        Institute institute = validateInstitute(instituteId);
        CollegeSettings settings = resolveSettings(institute);
        return toResponse(settings);
    }

    public CollegeSettingsResponse savePreferences(Long instituteId, PreferencesPayload request) {
        CollegeSettings settings = resolveSettings(validateInstitute(instituteId));
        settings.setAcademicYear(normalize(request.academicYear()));
        settings.setAcademicYearStartMonth(normalize(request.academicYearStartMonth()));
        settings.setAcademicYearEndMonth(normalize(request.academicYearEndMonth()));
        settings.setWorkingDays(normalize(request.workingDays()));
        settings.setTimezone(normalize(request.timezone()));
        settings.setLanguage(normalize(request.language()));
        settings.setDateFormat(normalize(request.dateFormat()));
        settings.setCurrency(normalize(request.currency()));
        settings.setTheme(normalize(request.theme()));
        settings.setStudentCodePrefix(normalizeUppercase(request.studentCodePrefix()));
        settings.setTeacherCodePrefix(normalizeUppercase(request.teacherCodePrefix()));
        return toResponse(collegeSettingsRepository.save(settings));
    }

    public CollegeSettingsResponse saveNotifications(Long instituteId, NotificationsPayload request) {
        CollegeSettings settings = resolveSettings(validateInstitute(instituteId));
        settings.setEmailNotice(request.emailNotice());
        settings.setSmsAlerts(request.smsAlerts());
        settings.setHolidayNotice(request.holidayNotice());
        settings.setFeeReminders(request.feeReminders());
        settings.setAttendanceAlerts(request.attendanceAlerts());
        return toResponse(collegeSettingsRepository.save(settings));
    }

    public FeatureAccessResponse saveFeatureAccess(Long instituteId, FeatureAccessPayload request) {
        Institute institute = validateInstitute(instituteId);
        String featureKey = normalizeFeature(request.feature());
        FeatureAccess access = featureAccessRepository.findByInstituteIdAndFeatureKey(instituteId, featureKey)
                .orElseGet(() -> {
                    FeatureAccess nextAccess = new FeatureAccess();
                    nextAccess.setInstitute(institute);
                    nextAccess.setFeatureKey(featureKey);
                    return nextAccess;
                });

        access.setEnabled(request.enabled());
        access.setPasswordHash(passwordEncoder.encode(request.password()));
        return toFeatureResponse(featureAccessRepository.save(access));
    }

    public FeatureLoginResponse loginFeature(FeatureLoginRequest request) {
        Institute institute = instituteRepository.findByUsernameIgnoreCase(request.username().trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid institution username or feature password."));
        String featureKey = normalizeFeature(request.feature());
        FeatureAccess access = featureAccessRepository.findByInstituteIdAndFeatureKey(institute.getId(), featureKey)
                .orElseThrow(() -> new IllegalArgumentException("This feature access is not enabled in settings."));

        if (!access.isEnabled() || !passwordEncoder.matches(request.password(), access.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid institution username or feature password.");
        }

        return new FeatureLoginResponse(
                institute.getId(),
                institute.getUsername(),
                institute.getInstituteName(),
                institute.getType(),
                "feature",
                access.getFeatureKey(),
                institute.getLogo()
        );
    }

    public void resetSettings(Long instituteId) {
        validateInstitute(instituteId);
        collegeSettingsRepository.findByInstituteId(instituteId).ifPresent(collegeSettingsRepository::delete);
        featureAccessRepository.findAllByInstituteIdOrderByFeatureKeyAsc(instituteId).forEach(featureAccessRepository::delete);
    }

    private CollegeSettingsResponse toResponse(CollegeSettings settings) {
        return new CollegeSettingsResponse(
                new PreferencesPayload(
                        defaultValue(settings.getAcademicYear(), "2026-2027"),
                        defaultValue(settings.getAcademicYearStartMonth(), "April"),
                        defaultValue(settings.getAcademicYearEndMonth(), "March"),
                        defaultValue(settings.getWorkingDays(), "Monday To Saturday"),
                        defaultValue(settings.getTimezone(), "Asia/Kolkata"),
                        defaultValue(settings.getLanguage(), "English"),
                        defaultValue(settings.getDateFormat(), "DD/MM/YYYY"),
                        defaultValue(settings.getCurrency(), "INR"),
                        defaultValue(settings.getTheme(), "Light"),
                        defaultValue(settings.getStudentCodePrefix(), "STU"),
                        defaultValue(settings.getTeacherCodePrefix(), "TCH")
                ),
                new NotificationsPayload(
                        settings.isEmailNotice(),
                        settings.isSmsAlerts(),
                        settings.isHolidayNotice(),
                        settings.isFeeReminders(),
                        settings.isAttendanceAlerts()
                ),
                featureAccessRepository.findAllByInstituteIdOrderByFeatureKeyAsc(settings.getInstitute().getId())
                        .stream()
                        .map(this::toFeatureResponse)
                        .toList(),
                settings.getUpdatedAt()
        );
    }

    private FeatureAccessResponse toFeatureResponse(FeatureAccess access) {
        return new FeatureAccessResponse(
                access.getFeatureKey(),
                access.isEnabled(),
                StringUtils.hasText(access.getPasswordHash()),
                access.getUpdatedAt()
        );
    }

    private CollegeSettings resolveSettings(Institute institute) {
        return collegeSettingsRepository.findByInstituteId(institute.getId())
                .orElseGet(() -> {
                    CollegeSettings settings = new CollegeSettings();
                    settings.setInstitute(institute);
                    settings.setAcademicYear("2026-2027");
                    settings.setAcademicYearStartMonth("April");
                    settings.setAcademicYearEndMonth("March");
                    settings.setWorkingDays("Monday To Saturday");
                    settings.setTimezone("Asia/Kolkata");
                    settings.setLanguage("English");
                    settings.setDateFormat("DD/MM/YYYY");
                    settings.setCurrency("INR");
                    settings.setTheme("Light");
                    settings.setStudentCodePrefix("STU");
                    settings.setTeacherCodePrefix("TCH");
                    return collegeSettingsRepository.save(settings);
                });
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private String normalizeFeature(String value) {
        if (!StringUtils.hasText(value)) {
            throw new FieldValidationException("Feature is required.", Map.of("feature", "Feature is required."));
        }
        return value.trim();
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String normalizeUppercase(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase() : null;
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }
}
