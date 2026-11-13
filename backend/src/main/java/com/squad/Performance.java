package com.squad;
import jakarta.persistence.*;
@Entity @Table(name="squad_performance") public class Performance { @Id @GeneratedValue(strategy=GenerationType.AUTO) public Long id; @Version public Long version; public Long playerId; public java.time.LocalDate matchDate; public int minutes; public int goals; public int assists; }
