package com.squad;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "squad_audit")
public class AuditEvent {
  @Id
  @SequenceGenerator(name = "audit_ids", sequenceName = "squad_audit_seq", allocationSize = 50)
  @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "audit_ids")
  public Long id;

  @Column(nullable = false, length = 120)
  public String actor;

  @Column(nullable = false, length = 60)
  public String action;

  @Column(nullable = false, length = 40)
  public String resource;

  public Long resourceId;
  public boolean financial;

  @Column(nullable = false)
  public Instant occurredAt;
}
