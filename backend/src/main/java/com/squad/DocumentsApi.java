package com.squad;

import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/contracts/{contractId}/documents")
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
@Transactional
public class DocumentsApi {
  final DocumentRepository documents;
  final ContractRepository contracts;
  final Clock clock;
  final Audit audit;

  DocumentsApi(DocumentRepository d, ContractRepository c, Clock cl, Audit a) {
    documents = d;
    contracts = c;
    clock = cl;
    audit = a;
  }

  @GetMapping
  List<DocumentRepository.Metadata> list(@PathVariable Long contractId) {
    contracts.findById(contractId).orElseThrow();
    return documents.findByContractIdOrderByIdDesc(contractId);
  }

  @PostMapping(consumes = "multipart/form-data")
  DocumentRepository.Metadata upload(
      @PathVariable Long contractId,
      @RequestPart("file") MultipartFile file,
      Principal principal,
      @RequestHeader("X-Requested-With") String requestedWith)
      throws Exception {
    if (!"Touchline".equals(requestedWith))
      throw new IllegalArgumentException("Invalid upload request");
    contracts.findById(contractId).orElseThrow();
    if (file.isEmpty() || file.getSize() > 5 * 1024 * 1024)
      throw new IllegalArgumentException("Choose a PDF document up to 5 MiB");
    byte[] bytes = file.getBytes();
    if (bytes.length < 5
        || !new String(bytes, 0, 5, java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-"))
      throw new IllegalArgumentException("Only PDF documents are accepted");
    var doc = new ContractDocument();
    doc.contractId = contractId;
    String filename =
        Objects.requireNonNullElse(file.getOriginalFilename(), "contract.pdf")
            .replace((char) 92, '/');
    filename =
        filename
            .substring(filename.lastIndexOf('/') + 1)
            .replaceAll("[^a-zA-Z0-9._-]", "_")
            .replaceAll("^[.]+", "");
    if (filename.isBlank()) filename = "contract.pdf";
    doc.filename = filename.substring(0, Math.min(120, filename.length()));
    doc.byteCount = bytes.length;
    doc.content = bytes;
    doc.sha256 = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    doc.uploadedAt = Instant.now(clock);
    doc.uploadedBy = principal.getName();
    documents.saveAndFlush(doc);
    audit.record("ATTACHED", "DOCUMENT", doc.id);
    return documents.findByContractIdOrderByIdDesc(contractId).stream()
        .filter(x -> x.getId().equals(doc.id))
        .findFirst()
        .orElseThrow();
  }

  @GetMapping("/{id}")
  ResponseEntity<byte[]> download(@PathVariable Long contractId, @PathVariable Long id) {
    var d = documents.findById(id).filter(x -> x.contractId.equals(contractId)).orElseThrow();
    return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_PDF)
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(d.filename).build().toString())
        .header("X-Content-Type-Options", "nosniff")
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .body(d.content);
  }
}
