package com.squad;

import jakarta.persistence.*;

@Entity
@Table(name = "squad_performance")
public class Performance {
  @Id
  @SequenceGenerator(
      name = "performance_ids",
      sequenceName = "squad_performance_seq",
      allocationSize = 50)
  @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "performance_ids")
  public Long id;

  @Version public Long version;
  public Long playerId;
  public java.time.LocalDate matchDate;
  public int minutes;
  public int goals;
  public int assists;
}
