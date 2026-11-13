package com.squad;

import jakarta.persistence.*;

@Entity
@Table(name = "squad_club")
public class Club {
  @Id
  @SequenceGenerator(name = "club_ids", sequenceName = "squad_club_seq", allocationSize = 50)
  @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "club_ids")
  public Long id;

  @Version public Long version;

  @Column(nullable = false, length = 120)
  public String name;
}
