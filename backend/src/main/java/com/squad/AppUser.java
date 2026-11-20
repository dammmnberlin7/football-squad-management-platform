package com.squad;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "squad_user", uniqueConstraints = @UniqueConstraint(columnNames = "username"))
public class AppUser {
  @Id
  @SequenceGenerator(name = "user_ids", sequenceName = "squad_user_seq", allocationSize = 50)
  @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "user_ids")
  public Long id;

  @Version public Long version;

  @Column(nullable = false, length = 80)
  public String username;

  @JsonIgnore
  @Column(nullable = false, length = 100)
  public String passwordHash;

  @Column(nullable = false, length = 60)
  public String roles;

  public boolean enabled = true;
}
