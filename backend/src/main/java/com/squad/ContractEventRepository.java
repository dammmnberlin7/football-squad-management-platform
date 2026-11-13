package com.squad;
import org.springframework.data.jpa.repository.*;import jakarta.persistence.LockModeType;import java.util.*;
public interface ContractEventRepository extends JpaRepository<ContractEvent,Long> { List<ContractEvent> findByContractId(Long contractId); }