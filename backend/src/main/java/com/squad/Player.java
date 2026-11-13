package com.squad;

import jakarta.persistence.*;

@Entity
@Table(name = "squad_player")
public class Player {
  @Id
  @SequenceGenerator(name = "player_ids", sequenceName = "squad_player_seq", allocationSize = 50)
  @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "player_ids")
  public Long id;

  @Version public Long version;

  @Column(nullable = false, length = 120)
  public String name;

  @Column(nullable = false, length = 40)
  public String position;

  public Long clubId;
}
