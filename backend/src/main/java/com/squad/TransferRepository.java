package com.squad;
import org.springframework.data.jpa.repository.*;import jakarta.persistence.LockModeType;import java.util.*;
public interface TransferRepository extends JpaRepository<Transfer,Long> {  }