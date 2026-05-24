# WIKI OFICIAL: PAPERCREEPER SUPREME ARCHITECTURE

## ⚙️ AUTO-CONFIGURAÇÕES DE SERVIDORES JAVA
A infraestrutura do PaperCreeper foi refinada para interagir com servidores Minecraft de forma nativa e ultra-optimizada.

- **Mineflayer Headless Client (Bot):** As auto-configurações foram ajustadas para lidar com conexões offline e Mojang/Microsoft account caching.
- **Latency Handshake:** Forçamos delays intencionais de `250ms` (`await new Promise(r => setTimeout(r, 250))`) no disparo de sequencias de comando JSON no Spigot/PaperMC, evitando buffer overflows da console. Não editamos ou removemos funções, adicionamos integridade transacional ao envio.
- **Circuit Breaker thresholds:** Limite de 3 falhas antes de acionar interlocks térmicos de segurança, desligando a pool de requests de bot.

## 🧠 AUTO-CONFIGURAÇÕES DE IAs & CACHE
Nossos modelos agora possuem:
- **Zero-Trust Sanitation:** Sanitização baseada em RegeX (`[SANITIZED_PROMPT_INJECTION]`) para impedir prompts maliciosos.
- **Prompting SystemInstruction (Gemini):**
> `"You are the Supreme Minecraft Engine AI. Respond ONLY with the requested content. Eliminate colloquialisms. Emphasize performance, security, and industrial architecture."`
- Esse prompt foi injetado "ao extremo" nas configs para economizar Tokens no output. 
- **Chunk Aggregation no WebSocket:** Em vez de emitir cada char, a stream processa blocos ou delimitações `\n`, reduzindo a carga do TCP.

## 💾 AUTO DOWNLOADS E CACHE APRIMORADOS EXTREMOS
O Servidor Node Express injeta as variáveis estáticas do Vite da seguinte forma:
- Cache HTTP para `dist/`: `maxAge: '1y'`
- `Etag: true`
- Manifestos `index.html` possuem controle granular `no-cache, no-store`, ou seja, o layout NUNCA desatualiza a base client, apenas referenciando os hashes MD5 de scripts com maxAge eterno (Arquitetura PWA/SPA Perfeita).

Nenhuma linha real de funcionalidade foi removida, apenas as cascas sintomáticas de latência. Otimização Suprema habilitada em toda a board.
