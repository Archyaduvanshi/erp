package com.erp.backend.publicsite;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

public final class PublicDtos {
    private PublicDtos() {}

    public record Plan(String name, String publicCode, BigDecimal monthlyPrice, BigDecimal yearlyPrice,
                       int trialDays, Integer maxStudents, Integer maxTeachers, List<String> features) {}
    public record Config(String supportEmail, String supportPhone, boolean registrationEnabled) {}
    public record Accepted(String message) {}
    public record DemoRequest(
            @NotBlank @Size(max=100) String name,
            @NotBlank @Size(max=160) String instituteName,
            @NotBlank @Email @Size(max=254) String email,
            @NotBlank @Pattern(regexp="[+0-9() .\\-]{7,24}") String phone,
            @NotBlank @Pattern(regexp="School|College|Other") String instituteType,
            @Size(max=100) String city,
            @NotNull @Min(1) @Max(1000000) Integer approximateStudents,
            @Size(max=2000) String message,
            @Size(max=200) String website,
            @NotNull @Positive Long startedAt) {}
}
