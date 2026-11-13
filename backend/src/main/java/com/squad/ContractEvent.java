package com.squad;
import jakarta.persistence.*;
@Entity @Table(name="squad_contractevent") public class ContractEvent { @Id @GeneratedValue(strategy=GenerationType.AUTO) public Long id; @Version public Long version; public Long contractId; public String action; public java.time.Instant occurredAt; public String actor; }
