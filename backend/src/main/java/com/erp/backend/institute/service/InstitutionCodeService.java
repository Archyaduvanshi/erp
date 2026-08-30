package com.erp.backend.institute.service;

import java.util.Arrays;
import java.util.Set;
import java.util.regex.Pattern;

import com.erp.backend.institute.repository.InstituteRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class InstitutionCodeService {

    public static final int MIN_CODE_LENGTH = 3;
    public static final int MAX_CODE_LENGTH = 20;
    private static final Pattern NON_ALPHANUMERIC_SPACE = Pattern.compile("[^A-Z0-9 ]");
    private static final Pattern MULTIPLE_SPACES = Pattern.compile("\\s+");
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^A-Z0-9]");
    private static final Set<String> STOP_WORDS = Set.of("THE", "OF", "AND");

    private final InstituteRepository instituteRepository;

    public InstitutionCodeService(InstituteRepository instituteRepository) {
        this.instituteRepository = instituteRepository;
    }

    public String generateBaseCode(String instituteName) {
        String normalizedName = normalizeName(instituteName);
        if (!StringUtils.hasText(normalizedName)) {
            return "INST";
        }

        String[] meaningfulWords = Arrays.stream(normalizedName.split(" "))
                .filter(StringUtils::hasText)
                .filter(word -> !STOP_WORDS.contains(word))
                .toArray(String[]::new);
        if (meaningfulWords.length == 0) {
            meaningfulWords = normalizedName.split(" ");
        }

        StringBuilder initials = new StringBuilder();
        for (String word : meaningfulWords) {
            if (StringUtils.hasText(word)) {
                initials.append(word.charAt(0));
            }
        }

        String base = initials.toString();
        if (base.length() < MIN_CODE_LENGTH) {
            base = firstWordPrefix(meaningfulWords);
        }
        if (base.length() < MIN_CODE_LENGTH) {
            base = (base + "INST").substring(0, MIN_CODE_LENGTH);
        }
        return truncate(base, MAX_CODE_LENGTH);
    }

    public String normalizeManualCode(String code) {
        String normalized = normalizeCode(code);
        if (normalized.length() < MIN_CODE_LENGTH || normalized.length() > MAX_CODE_LENGTH) {
            throw new IllegalArgumentException("INSTITUTION_CODE_INVALID_LENGTH: Institution code must be between 3 and 20 characters.");
        }
        return normalized;
    }

    public String normalizeCode(String code) {
        String normalized = StringUtils.hasText(code)
                ? NON_ALPHANUMERIC.matcher(code.trim().toUpperCase()).replaceAll("")
                : "";
        if (!StringUtils.hasText(normalized)) {
            throw new IllegalArgumentException("INSTITUTION_CODE_REQUIRED: Institution code is required.");
        }
        return normalized;
    }

    public String nextAvailableCode(String instituteName) {
        String baseCode = generateBaseCode(instituteName);
        String candidate = baseCode;
        int suffix = 1;
        while (instituteRepository.existsByUsernameIgnoreCase(candidate)) {
            String suffixText = suffix < 100 ? String.format("%02d", suffix) : String.valueOf(suffix);
            int baseLength = Math.max(MIN_CODE_LENGTH, MAX_CODE_LENGTH - suffixText.length());
            candidate = truncate(baseCode, baseLength) + suffixText;
            suffix++;
        }
        return candidate;
    }

    public String withSuffix(String baseCode, int suffix) {
        if (suffix <= 0) return truncate(baseCode, MAX_CODE_LENGTH);
        String suffixText = suffix < 100 ? String.format("%02d", suffix) : String.valueOf(suffix);
        int baseLength = Math.max(MIN_CODE_LENGTH, MAX_CODE_LENGTH - suffixText.length());
        return truncate(baseCode, baseLength) + suffixText;
    }

    public String tenantPrefix(String storedInstitutionCode) {
        String code = normalizeCode(storedInstitutionCode);
        return truncate(code, MAX_CODE_LENGTH);
    }

    private String normalizeName(String value) {
        String cleaned = StringUtils.hasText(value)
                ? NON_ALPHANUMERIC_SPACE.matcher(value.trim().toUpperCase()).replaceAll(" ")
                : "";
        return MULTIPLE_SPACES.matcher(cleaned).replaceAll(" ").trim();
    }

    private String firstWordPrefix(String[] words) {
        for (String word : words) {
            if (StringUtils.hasText(word)) {
                return truncate(word, Math.min(MAX_CODE_LENGTH, 8));
            }
        }
        return "";
    }

    private String truncate(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
