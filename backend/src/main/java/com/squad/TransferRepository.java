package com.squad;

import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface TransferRepository
    extends JpaRepository<Transfer, Long>,
        org.springframework.data.jpa.repository.JpaSpecificationExecutor<Transfer> {}
