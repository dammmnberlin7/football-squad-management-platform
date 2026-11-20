package com.squad;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "squad_document")
public class ContractDocument {
  @Id
  @SequenceGenerator(
      name = "document_ids",
      sequenceName = "squad_document_seq",
      allocationSize = 50)
  @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "document_ids")
  public Long id;

  @Column(nullable = false)
  public Long contractId;

  @Column(nullable = false, length = 120)
  public String filename;

  public long byteCount;

  @Column(nullable = false, length = 64)
  public String sha256;

  @Column(nullable = false)
  public Instant uploadedAt;

  @Column(nullable = false, length = 120)
  public String uploadedBy;

  @Lob
  @JsonIgnore
  @Column(nullable = false)
  public byte[] content;
}
