package com.squad;

import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ContractEventRepository extends JpaRepository<ContractEvent, Long> {
  List<ContractEvent> findByContractId(Long contractId);
}
