package com.erp.backend.platform.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public final class PlatformDtos {
    private PlatformDtos() {}

    public record Overview(
            long totalInstitutes, long activeInstitutes, long trialInstitutes, long suspendedInstitutes,
            long expiredInstitutes, long totalStudents, long totalTeachers, long activeSubscriptions,
            long expiringIn7Days, long expiringIn30Days, long paymentGatewayEnabledInstitutes,
            BigDecimal monthlySubscriptionRevenue, BigDecimal yearlySubscriptionRevenue,
            List<RecentInstitute> recentInstitutes, List<ExpiringSubscription> expiringSubscriptions
    ) {}

    public record RecentInstitute(Long id, String instituteName, String institutionCode, String status, LocalDateTime registeredAt) {}
    public record ExpiringSubscription(Long instituteId, String instituteName, String plan, LocalDate endDate, long daysRemaining) {}

    public record InstituteRow(
            Long id, String instituteName, String institutionCode, String type, String city, String state,
            String status, String plan, long studentCount, long teacherCount, long enabledFeatureCount,
            LocalDateTime registeredAt, LocalDate subscriptionExpiry, String subscriptionStatus, String paymentGatewayStatus
    ) {}

    public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {}

    public record InstituteDetail(
            Long id, String instituteName, String institutionCode, String type, String affiliationNo,
            String affiliatedFrom, String email, String contact, String website, String address, String city,
            String state, String pincode, String status, String statusReason, LocalDateTime registeredAt,
            long studentCount, long teacherCount, long classCount, long sectionCount, String currentPlan,
            String subscriptionStatus, LocalDate subscriptionExpiry, long enabledFeatureCount,
            String gatewayProvider, String gatewayStatus, boolean paymentsEnabled, long version
    ) {}

    public record FeatureAccess(
            String code, String legacyKey, String label, boolean planEnabled, Boolean overrideEnabled,
            boolean configuredEnabled, boolean effectiveEnabled, String source, String accessStatus,
            String blockedReason, String reason, LocalDateTime updatedAt, Long version
    ) {}

    public record FeatureInstituteRow(Long instituteId, String instituteName, String institutionCode,
                                      String instituteStatus, String plan, String subscriptionStatus,
                                      long configuredFeatures, long effectiveFeatures) {}

    public record FeatureUpdate(@NotBlank String featureCode, @NotNull Boolean enabled, @NotBlank String reason, Long version) {}

    public record Plan(
            Long id, String code, String name, BigDecimal monthlyPrice, BigDecimal yearlyPrice,
            Integer maxStudents, Integer maxTeachers, Integer maxUsers, Integer maxStorageMb,
            int trialDays, String status, List<String> features, long version
    ) { @com.fasterxml.jackson.annotation.JsonProperty public int featureCount() { return features.size(); } }

    public record PlanPayload(
            Long id, @NotBlank String code, @NotBlank String name,
            BigDecimal monthlyPrice, BigDecimal yearlyPrice,
            Integer maxStudents, Integer maxTeachers, Integer maxUsers, Integer maxStorageMb,
            int trialDays, @NotBlank String status, List<String> features, Long version, String reason
    ) {}

    public record Subscription(
            Long id, Long instituteId, Long planId, String planCode, String planName, String status,
            String billingCycle, LocalDate startDate, LocalDate endDate, BigDecimal amount, String currency,
            boolean autoRenew, String changeReason, LocalDateTime createdAt, long version
    ) {}

    public record SubscriptionChange(
            @NotNull Long planId, @NotBlank String status, @NotBlank String billingCycle,
            @NotNull LocalDate startDate, @NotNull LocalDate endDate, @PositiveOrZero BigDecimal amount,
            boolean autoRenew, String reason, Long currentSubscriptionId, Long currentVersion
    ) {}

    public record SubscriptionSummary(long totalPlans, long activePlans, long activeSubscriptions,
                                      long trialInstitutes, long expiringIn7Days, long expiringIn30Days) {}
    public record TrialExtension(@NotNull LocalDate endDate, @NotBlank String reason, @NotNull Long version) {}
    public record PlanStatus(@NotBlank String status, @NotNull Long version, @NotBlank String reason) {}

    public record SubscriptionRow(Long id, Long instituteId, String instituteName, String institutionCode,
                                  Long planId, String planCode, String planName, String status,
                                  String billingCycle, LocalDate startDate, LocalDate endDate,
                                  BigDecimal amount, boolean autoRenew) {}

    public record Usage(
            Long instituteId, long students, long teachers, long activeAccounts, long classes,
            long sections, long exams, long libraryBooks, long hostelResidents, long transportStudents,
            String plan, Integer maxStudents, Integer maxTeachers, Integer maxUsers,
            double studentPercent, double teacherPercent, double userPercent
    ) {}

    public record UsageOverview(long institutes, long students, long teachers, long activeAccounts,
                                long classes, long sections, long libraryBooks, long hostelResidents,
                                long transportStudents) {}

    public record UsageRow(Long instituteId, String instituteName, String institutionCode, String status,
                           String plan, long students, Integer maxStudents, long teachers, Integer maxTeachers,
                           long activeAccounts, Integer maxUsers, String limitStatus) {}

    public record Gateway(
            Long instituteId, String provider, String merchantId, String kycStatus, String productStatus,
            boolean paymentsEnabled, LocalDateTime lastSync
    ) {}
    public record GatewayRow(Long instituteId, String instituteName, String institutionCode, String provider,
                             String externalAccountId, String kycStatus, String productStatus,
                             boolean paymentsEnabled, LocalDateTime lastSync) {}

    public record Invoice(
            Long id, String invoiceNumber, Long instituteId, String instituteName, String plan,
            LocalDate periodStart, LocalDate periodEnd, BigDecimal amount, BigDecimal tax,
            BigDecimal totalAmount, LocalDate dueDate, LocalDateTime paidAt, String status,
            String paymentReference, String notes, LocalDateTime createdAt, long version
    ) {}

    public record InvoicePayload(
            @NotNull Long instituteId, Long subscriptionId, String invoiceNumber,
            @NotNull @PositiveOrZero BigDecimal amount, @NotNull @PositiveOrZero BigDecimal tax,
            @NotNull LocalDate dueDate, @NotBlank String status, String paymentReference, String notes
    ) {}

    public record InvoiceStatusChange(@NotBlank String reason, String paymentReference, Long version) {}

    public record StatusChange(@NotBlank String reason, Long version) {}
    public record NotePayload(@NotBlank String note) {}
    public record InternalNote(Long id, Long instituteId, Long platformUserId, String author, String note, LocalDateTime createdAt) {}
    public record AuditRow(Long id, Long platformUserId, String actor, String action, String targetType,
                           String targetId, Long targetInstituteId, String instituteName, String reason,
                           String oldValueJson, String newValueJson, String ipAddress, LocalDateTime createdAt) {}
    public record PlatformSetting(String key, String value, LocalDateTime updatedAt) {}
    public record SettingsUpdate(String defaultTrialDays, String defaultPlan, String platformSupportEmail,
                                 String platformSupportPhone, String registrationEnabled,
                                 @NotBlank String reason) {}
}
