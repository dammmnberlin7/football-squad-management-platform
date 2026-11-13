package com.squad;

import jakarta.persistence.*;

@Entity
@Table(name = "squad_contract")
public class Contract {
  @Id
  @SequenceGenerator(
      name = "contract_ids",
      sequenceName = "squad_contract_seq",
      allocationSize = 50)
  @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "contract_ids")
  public Long id;

  @Version public Long version;
  public Long playerId;
  public Long clubId;
  public java.time.LocalDate starts;
  public java.time.LocalDate ends;

  @Column(nullable = false, precision = 14, scale = 2)
  public java.math.BigDecimal salary;

  @Column(nullable = false, length = 20)
  public String status = "DRAFT";
}
