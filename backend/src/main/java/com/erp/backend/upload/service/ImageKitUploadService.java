package com.erp.backend.upload.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

import com.erp.backend.upload.dto.ImageKitUploadResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ImageKitUploadService {
    private static final String IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${imagekit.private-key:}")
    private String privateKey;

    @Value("${imagekit.default-folder:/erp}")
    private String defaultFolder;

    public ImageKitUploadService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newHttpClient();
    }

    public ImageKitUploadResponse upload(MultipartFile file, String folder) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Upload file is required.");
        }
        if (!isConfiguredSecret(privateKey)) {
            throw new IllegalStateException("ImageKit private key is not configured. Set IMAGEKIT_PRIVATE_KEY in backend/.env.");
        }

        String boundary = "----erp-imagekit-" + UUID.randomUUID();
        String targetFolder = normalizeFolder(folder);

        try {
            byte[] requestBody = buildMultipartBody(file, targetFolder, boundary);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(IMAGEKIT_UPLOAD_URL))
                    .header("Authorization", "Basic " + Base64.getEncoder().encodeToString((privateKey + ":").getBytes(StandardCharsets.UTF_8)))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("ImageKit upload failed: " + response.body());
            }

            JsonNode body = objectMapper.readTree(response.body());
            String uploadedUrl = body.path("url").asText("");
            if (!StringUtils.hasText(uploadedUrl)) {
                throw new IllegalStateException("ImageKit upload completed without a file URL.");
            }
            return new ImageKitUploadResponse(
                    uploadedUrl,
                    body.path("fileId").asText(""),
                    body.path("name").asText(file.getOriginalFilename()),
                    body.path("filePath").asText(""),
                    body.path("thumbnailUrl").asText(""),
                    body.path("fileType").asText(file.getContentType()),
                    body.path("size").isNumber() ? body.path("size").asLong() : file.getSize()
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to upload file to ImageKit.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("ImageKit upload was interrupted.", exception);
        }
    }

    private byte[] buildMultipartBody(MultipartFile file, String folder, String boundary) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();

        writeTextPart(output, boundary, "fileName", sanitizeFileName(file.getOriginalFilename()));
        writeTextPart(output, boundary, "folder", folder);
        writeTextPart(output, boundary, "useUniqueFileName", "true");
        writeFilePart(output, boundary, file);
        output.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

        return output.toByteArray();
    }

    private void writeTextPart(ByteArrayOutputStream output, String boundary, String name, String value) throws IOException {
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(String.valueOf(value).getBytes(StandardCharsets.UTF_8));
        output.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private void writeFilePart(ByteArrayOutputStream output, String boundary, MultipartFile file) throws IOException {
        String contentType = StringUtils.hasText(file.getContentType()) ? file.getContentType() : "application/octet-stream";
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + sanitizeFileName(file.getOriginalFilename()) + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(file.getBytes());
        output.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private String normalizeFolder(String folder) {
        String selectedFolder = StringUtils.hasText(folder) ? folder.trim() : defaultFolder;
        if (!selectedFolder.startsWith("/")) {
            selectedFolder = "/" + selectedFolder;
        }
        return selectedFolder.replaceAll("/{2,}", "/");
    }

    private String sanitizeFileName(String fileName) {
        String safeName = StringUtils.hasText(fileName) ? fileName.trim() : "upload";
        return safeName.replaceAll("[\\\\/\\r\\n\"]", "-");
    }

    private boolean isConfiguredSecret(String value) {
        return StringUtils.hasText(value) && !value.trim().startsWith("replace_with_");
    }
}
