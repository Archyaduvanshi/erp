package com.erp.backend.hostel.dto;

import java.util.List;
import java.util.Map;

public record HostelMessMenuPayload(
        List<HostelMessMenuRow> rows
) {

    public record HostelMessMenuRow(
            String id,
            String mealName,
            Map<String, String> vegetarian,
            Map<String, String> nonVegetarian
    ) {
    }
}
