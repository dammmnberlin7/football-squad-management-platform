package com.squad;
import jakarta.persistence.*;
@Entity @Table(name="squad_transfer") public class Transfer { @Id @GeneratedValue(strategy=GenerationType.AUTO) public Long id; @Version public Long version; public Long playerId; public Long fromClubId; public Long toClubId; public java.math.BigDecimal fee; public java.time.LocalDate completedOn; }
