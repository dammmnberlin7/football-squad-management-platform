package com.squad;

import jakarta.persistence.*;

@Entity
@Table(name = "squad_demo")
public class DemoState {
  @Id public Long id = 1L;
  public boolean loaded;
}
