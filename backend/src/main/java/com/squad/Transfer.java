package com.squad;

import jakarta.persistence.*;

@Entity
@Table(name = "squad_transfer")
public class Transfer {
  @Id
  @SequenceGenerator(
      name = "transfer_ids",
      sequenceName = "squad_transfer_seq",
      allocationSize = 50)
  @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "transfer_ids")
  public Long id;

  @Version public Long version;
  public Long playerId;
  public Long fromClubId;
  public Long toClubId;

  @Column(nullable = false, precision = 14, scale = 2)
  public java.math.BigDecimal fee;

  public java.time.LocalDate completedOn;
}
