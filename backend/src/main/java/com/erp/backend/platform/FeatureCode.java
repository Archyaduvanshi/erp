package com.erp.backend.platform;

import java.util.Arrays;
import java.util.List;

public enum FeatureCode {
    STUDENT_MANAGEMENT("admissionStudent", "Student Management"),
    TEACHER_MANAGEMENT("teacher", "Teacher Management"),
    COURSE_SUBJECT("courses", "Classes & Subjects"),
    ATTENDANCE("attendance", "Attendance"),
    TIMETABLE("timetable", "Timetable"),
    EXAMINATION("examinations", "Examination"),
    RESULT("result", "Results"),
    FEES("fees", "Fees"),
    LIBRARY("library", "Library"),
    HOSTEL("hostel", "Hostel"),
    TRANSPORT("transport", "Transport"),
    SALARY("salary", "Salary"),
    REPORTS("reports", "Reports"),
    NOTICES("notices", "Notices"),
    HOLIDAYS("holidays", "Holidays"),
    CASHBOOK("cashbook", "Cashbook & Finance"),
    LIVE_TRANSPORT_TRACKING("liveTransportTracking", "Live Transport Tracking");

    private final String legacyKey;
    private final String label;

    FeatureCode(String legacyKey, String label) {
        this.legacyKey = legacyKey;
        this.label = label;
    }

    public String legacyKey() { return legacyKey; }
    public String label() { return label; }

    public static FeatureCode fromLegacyKey(String key) {
        return Arrays.stream(values()).filter(value -> value.legacyKey.equals(key)).findFirst().orElse(null);
    }

    public static List<FeatureDefinition> registry() {
        return Arrays.stream(values()).map(value -> new FeatureDefinition(value.name(), value.legacyKey, value.label)).toList();
    }

    public static String sqlValues() {
        return "(values " + Arrays.stream(values()).map(f -> "('" + f.name() + "')").collect(java.util.stream.Collectors.joining(",")) + ")";
    }
    public record FeatureDefinition(String code, String legacyKey, String label) {
        @com.fasterxml.jackson.annotation.JsonProperty public String displayName() { return label; }
    }
}
