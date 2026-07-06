package com.predictive;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * PredictiveMarketApplicationTests — Verifies that the Spring application
 * context loads successfully with the local (H2) profile.
 */
@SpringBootTest
@ActiveProfiles("local")
class PredictiveMarketApplicationTests {

    @Test
    void contextLoads() {
        // If this test passes, Spring context loaded without errors
    }
}
