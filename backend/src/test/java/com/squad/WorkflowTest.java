package com.squad;
import org.junit.jupiter.api.*;import org.springframework.beans.factory.annotation.*;import org.springframework.boot.test.context.SpringBootTest;import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;import org.springframework.test.web.servlet.*;import org.springframework.security.test.context.support.WithMockUser;import com.fasterxml.jackson.databind.*;import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest @AutoConfigureMockMvc class WorkflowTest {
@Autowired MockMvc mvc;@Autowired ObjectMapper json;
JsonNode postJson(String path,String body,int status)throws Exception{return json.readTree(mvc.perform(post("/api/"+path).contentType("application/json").content(body)).andExpect(status().is(status)).andReturn().getResponse().getContentAsString());}
@Test void healthAndAuthentication()throws Exception{mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));mvc.perform(get("/api/players")).andExpect(status().isUnauthorized());}
@Test @WithMockUser(roles="COACH") void financialDataProtected()throws Exception{mvc.perform(get("/api/contracts")).andExpect(status().isForbidden());mvc.perform(get("/api/transfers")).andExpect(status().isForbidden());mvc.perform(get("/api/dashboard")).andExpect(status().isOk()).andExpect(jsonPath("$.transferSpend").doesNotExist());postJson("clubs","{\"name\":\"Forbidden\"}",403);}
@Test @WithMockUser(roles="ADMIN") void completeLifecycle()throws Exception{
long a=postJson("clubs","{\"name\":\"Berlin\"}",200).get("id").asLong();long b=postJson("clubs","{\"name\":\"London\"}",200).get("id").asLong();long p=postJson("players","{\"name\":\"Alex\",\"position\":\"Forward\",\"clubId\":"+a+"}",200).get("id").asLong();
String terms="{\"playerId\":"+p+",\"clubId\":"+a+",\"starts\":\"2026-01-01\",\"ends\":\"2028-12-31\",\"salary\":100000}";
long c=postJson("contracts",terms,200).get("id").asLong();var signed=postJson("contracts/"+c+"/sign","{\"version\":0}",200);Assertions.assertEquals("SIGNED",signed.get("status").asText());
long d=postJson("contracts",terms,200).get("id").asLong();postJson("contracts/"+d+"/sign","{\"version\":0}",409);
mvc.perform(put("/api/contracts/"+c).contentType("application/json").content(terms.substring(0,terms.length()-1)+",\"version\":1}")).andExpect(status().isConflict());
postJson("transfers","{\"playerId\":"+p+",\"toClubId\":"+b+",\"fee\":250000,\"playerVersion\":5}",409);
postJson("transfers","{\"playerId\":"+p+",\"toClubId\":"+b+",\"fee\":250000,\"playerVersion\":0}",200);
mvc.perform(get("/api/contracts/"+c+"/history")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
mvc.perform(get("/api/contracts")).andExpect(jsonPath("$[?(@.id == "+c+")].status").value("TERMINATED"));
postJson("performances","{\"playerId\":"+p+",\"matchDate\":\"2026-01-01\",\"minutes\":90,\"goals\":2,\"assists\":1}",200);
mvc.perform(get("/api/dashboard")).andExpect(jsonPath("$.goals").value(2));}
@Test @WithMockUser(roles="ADMIN") void rejectsInvalidRequests()throws Exception{postJson("clubs","{\"name\":\"\"}",400);postJson("performances","{\"playerId\":1,\"matchDate\":\"2026-01-01\",\"minutes\":-1,\"goals\":0,\"assists\":0}",400);}
}
