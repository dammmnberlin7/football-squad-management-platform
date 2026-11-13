package com.squad;
import jakarta.persistence.*;
@Entity @Table(name="squad_contract") public class Contract { @Id @GeneratedValue(strategy=GenerationType.AUTO) public Long id; @Version public Long version; public Long playerId; public Long clubId; public java.time.LocalDate starts; public java.time.LocalDate ends; public java.math.BigDecimal salary; public String status="DRAFT"; }
