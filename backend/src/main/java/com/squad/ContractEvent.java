package com.squad;

import jakarta.persistence.*;

@Entity
@Table(name = "squad_contractevent")
public class ContractEvent {
  @Id
  @SequenceGenerator(
      name = "contractevent_ids",
      sequenceName = "squad_contractevent_seq",
      allocationSize = 50)
  @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "contractevent_ids")
  public Long id;

  @Version public Long version;
  public Long contractId;

  @Column(nullable = false, length = 40)
  public String action;

  public java.time.Instant occurredAt;

  @Column(nullable = false, length = 120)
  public String actor;
}
