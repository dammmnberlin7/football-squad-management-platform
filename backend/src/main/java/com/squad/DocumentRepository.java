package com.squad;

import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<ContractDocument, Long> {
  interface Metadata {
    Long getId();

    Long getContractId();

    String getFilename();

    long getByteCount();

    String getSha256();

    Instant getUploadedAt();

    String getUploadedBy();
  }

  List<Metadata> findByContractIdOrderByIdDesc(Long contractId);
}
