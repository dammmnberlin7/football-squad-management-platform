package com.squad;
import jakarta.persistence.*;
@Entity @Table(name="squad_player") public class Player { @Id @GeneratedValue(strategy=GenerationType.AUTO) public Long id; @Version public Long version; public String name; public String position; public Long clubId; }
