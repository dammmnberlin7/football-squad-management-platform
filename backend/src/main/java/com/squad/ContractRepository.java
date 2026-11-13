package com.squad;

import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ContractRepository extends JpaRepository<Contract, Long> {
  List<Contract> findByPlayerId(Long playerId);
}
