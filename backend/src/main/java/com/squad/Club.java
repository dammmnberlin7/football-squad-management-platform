package com.squad;
import jakarta.persistence.*;
@Entity @Table(name="squad_club") public class Club { @Id @GeneratedValue(strategy=GenerationType.AUTO) public Long id; @Version public Long version; public String name; }
