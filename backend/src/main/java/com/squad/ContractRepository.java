package com.squad;
import org.springframework.data.jpa.repository.*;import jakarta.persistence.LockModeType;import java.util.*;
public interface ContractRepository extends JpaRepository<Contract,Long> { List<Contract> findByPlayerId(Long playerId); }