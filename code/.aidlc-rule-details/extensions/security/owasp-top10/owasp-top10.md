# Extension: Enterdev Security — OWASP Top 10 (2021)

> **ENTERDEV S.A.S.** — Extensión corporativa de seguridad de aplicaciones.
> Versión: 1.0 | Estado: Activo | Tipo: Security Extension (opt-in)

## Purpose

Garantizar que todo software desarrollado bajo AI-DLC incorpore controles contra las
diez categorías de riesgo del **OWASP Top 10 (2021)**. Cada categoría se traduce en
una regla verificable; las reglas aplicables son restricciones bloqueantes en las
etapas de diseño, generación de código y build & test.

## Scope

El alcance (FULL o lista parcial de categorías) se selecciona mediante
`owasp-top10.opt-in.md` durante Requirements Analysis y DEBE registrarse en
`aidlc-docs/aidlc-state.md` bajo `## Extension Configuration`:

```markdown
## Extension Configuration
- Extension: owasp-top10
- Enabled: true
- Scope: FULL | A01,A03,A09 (ejemplo parcial)
```

Las categorías fuera del scope activo se reportan como **N/A** en el resumen de
cumplimiento (no son blocking). Una regla aplicable NON-COMPLIANT es un **blocking
finding**: NO presentar la finalización de la etapa hasta resolverla.

---

## OWASP-A01: Broken Access Control
- **Requirement**: Todo endpoint, página o recurso DEBE declarar su política de
  autorización explícita (deny-by-default). Los controles de acceso se aplican en el
  servidor (nunca solo en UI), incluyen verificación de propiedad del recurso
  (anti IDOR: el usuario solo accede a SUS registros) y las historias de usuario
  con datos sensibles DEBEN incluir criterios de aceptación de autorización.
- **Prohibited**: Endpoints sin política explícita; confiar en ocultar botones/rutas
  del frontend como control de acceso; IDs secuenciales expuestos sin verificación
  de pertenencia; CORS con `*` en recursos autenticados.
- **Verification**: Cada ruta/handler tiene autorización declarada o una justificación
  documentada de acceso anónimo; existen pruebas negativas (403/404) para acceso
  entre usuarios/tenants.
- **Severity**: BLOCKING

## OWASP-A02: Cryptographic Failures
- **Requirement**: Clasificar los datos (público/interno/sensible/PII) en el diseño.
  Datos sensibles cifrados en tránsito (TLS 1.2+) y en reposo. Contraseñas con hash
  adaptativo (bcrypt/argon2/PBKDF2); algoritmos y modos actuales (AES-GCM,
  SHA-256+); claves y semillas desde generadores criptográficamente seguros.
- **Prohibited**: MD5/SHA-1 para contraseñas o firmas; cifrados propios ("crypto
  casero"); claves/IVs codificados en el código; HTTP plano en producción;
  almacenar datos sensibles innecesarios.
- **Verification**: Inventario de datos sensibles con su mecanismo de protección;
  cero algoritmos débiles en el código; configuración TLS documentada.
- **Severity**: BLOCKING

## OWASP-A03: Injection
- **Requirement**: Toda consulta a base de datos usa parámetros/ORM (nunca
  concatenación de entrada de usuario). Toda salida a HTML se codifica según el
  contexto (auto-escaping del framework). Comandos de SO, LDAP, XPath y
  deserialización tratan la entrada como no confiable. Validación de entrada
  server-side con listas de valores permitidos en todos los parámetros.
- **Prohibited**: SQL/NoSQL construido por concatenación; `eval`/ejecución dinámica
  de entrada de usuario; `innerHTML`/`bypassSecurityTrust*` con datos externos sin
  sanitizar; deshabilitar el escaping del framework.
- **Verification**: Cero consultas concatenadas en la revisión de código; pruebas con
  payloads típicos de inyección en los endpoints que aceptan entrada.
- **Severity**: BLOCKING

## OWASP-A04: Insecure Design
- **Requirement**: En Application/Functional Design de cada Unit con superficie
  sensible, documentar un modelado de amenazas ligero: actores, superficies de
  ataque, abusos previsibles y contramedidas. Aplicar límites de negocio
  (rate limiting, cuotas, límites de tamaño) y segregación de ambientes
  (dev/test/prod) desde el diseño.
- **Prohibited**: Diseñar flujos sensibles (pagos, autenticación, recuperación de
  cuenta) sin considerar casos de abuso; recursos ilimitados por usuario anónimo.
- **Verification**: El documento de diseño del Unit incluye la sección de amenazas y
  contramedidas, o una justificación de N/A para units sin superficie de ataque.
- **Severity**: BLOCKING

## OWASP-A05: Security Misconfiguration
- **Requirement**: Configuración segura por defecto: deshabilitar features y cuentas
  no usadas; mensajes de error genéricos hacia el cliente (sin stack traces);
  cabeceras de seguridad HTTP en aplicaciones web (CSP, X-Content-Type-Options,
  HSTS, X-Frame-Options/frame-ancestors); configuración idéntica y reproducible
  entre ambientes (IaC/archivos versionados sin secretos).
- **Prohibited**: Credenciales o configuraciones por defecto en producción; listados
  de directorio habilitados; modos debug/verbose en producción; XML parsers con
  entidades externas habilitadas (XXE).
- **Verification**: Checklist de hardening en Build & Test; respuesta de error de
  producción no revela detalles internos; cabeceras verificadas en pruebas.
- **Severity**: BLOCKING

## OWASP-A06: Vulnerable and Outdated Components
- **Requirement**: Dependencias declaradas con versiones fijadas y lockfile
  versionado; solo componentes de fuentes oficiales; escaneo de vulnerabilidades
  en cada build (`dotnet list package --vulnerable`, `npm audit`, `govulncheck`,
  Dependabot o equivalente) con umbral: cero vulnerabilidades CRITICAL/HIGH sin
  mitigación documentada; eliminar dependencias sin uso.
- **Prohibited**: Dependencias sin mantenimiento conocido para funciones de
  seguridad; copiar código de terceros sin registrar su procedencia y licencia.
- **Verification**: Reporte de escaneo limpio (o excepciones aprobadas en audit.md)
  como parte del gate de Build & Test.
- **Severity**: BLOCKING

## OWASP-A07: Identification and Authentication Failures
- **Requirement**: Autenticación con estándares probados (OIDC/OAuth2, ASP.NET
  Identity, etc.); política de contraseñas alineada a NIST 800-63B (longitud mínima
  8+, verificación contra listas de contraseñas filtradas, sin rotación forzada
  arbitraria); protección contra fuerza bruta (throttling/lockout progresivo);
  sesiones con expiración, invalidación en logout y regeneración de ID tras login;
  MFA disponible para cuentas administrativas.
- **Prohibited**: Credenciales en texto plano o en URLs; tokens de sesión sin
  expiración; respuestas que permitan enumeración de usuarios (mensajes o tiempos
  distinguibles); implementar autenticación criptográfica propia.
- **Verification**: Flujo de autenticación documentado en el diseño; pruebas de
  login/logout/expiración; revisión de mensajes de error de autenticación.
- **Severity**: BLOCKING

## OWASP-A08: Software and Data Integrity Failures
- **Requirement**: Verificar integridad de artefactos y dependencias (lockfiles con
  hashes, firmas cuando existan); pipeline CI/CD con pasos revisables y sin
  ejecución de código no confiable; deserialización solo de formatos de datos
  (JSON/XML sin tipos) — nunca deserialización binaria de entrada externa;
  actualizaciones automáticas solo desde canales firmados.
- **Prohibited**: `BinaryFormatter` o deserialización polimórfica de entrada externa;
  scripts de instalación `curl | bash` sin verificación en pipelines productivos;
  CDN de terceros sin Subresource Integrity en páginas sensibles.
- **Verification**: Lockfiles versionados; revisión del pipeline; cero
  deserialización insegura en el código.
- **Severity**: BLOCKING

## OWASP-A09: Security Logging and Monitoring Failures
- **Requirement**: Registrar con contexto suficiente (quién, qué, cuándo, desde
  dónde) los eventos de seguridad: logins exitosos/fallidos, fallos de
  autorización, validaciones rechazadas, cambios de datos sensibles y errores del
  servidor. Logs estructurados, centralizables y protegidos contra manipulación.
  Definir en el diseño qué alertas disparan los patrones de abuso.
- **Prohibited**: Registrar secretos, tokens, contraseñas o PII innecesaria en logs;
  logs solo en consola local en producción; silenciar excepciones sin registro.
- **Verification**: Matriz de eventos de seguridad → log/alerta en el diseño del
  Unit; inspección de logs en pruebas de integración (eventos presentes, secretos
  ausentes).
- **Severity**: BLOCKING

## OWASP-A10: Server-Side Request Forgery (SSRF)
- **Requirement**: Toda funcionalidad que obtenga recursos remotos a partir de
  entrada del usuario (URLs, webhooks, importadores) DEBE validar el destino contra
  una lista de dominios/esquemas permitidos, bloquear rangos internos
  (localhost, 169.254.169.254, RFC 1918) tras resolver DNS, deshabilitar
  redirecciones automáticas hacia destinos no validados y ejecutarse con egress
  restringido cuando la plataforma lo permita.
- **Prohibited**: `fetch`/`HttpClient` directo sobre URLs de usuario sin validación;
  exponer respuestas crudas de servicios internos al cliente.
- **Verification**: Inventario de puntos de salida HTTP iniciados por entrada de
  usuario con su validación; pruebas negativas con destinos internos.
- **Severity**: BLOCKING

---

## Compliance

- **Applicable stages**: Requirements Analysis (opt-in y registro de scope),
  Application Design, Functional Design, Code Generation, Build & Test.
- **Enforcement**: Al presentar la finalización de cada etapa aplicable, incluir el
  resumen de cumplimiento por categoría: `COMPLIANT | NON-COMPLIANT | N/A` (con
  justificación breve para cada N/A, incluyendo las N/A por scope parcial o por
  ausencia de la superficie correspondiente — p. ej. A10 en una app sin salidas
  HTTP dirigidas por el usuario).
- **Blocking**: Cualquier categoría aplicable NON-COMPLIANT impide presentar la
  finalización de la etapa. El agente debe auto-corregir o solicitar decisión al
  usuario, registrando todo en `audit.md`.
- **Desviaciones**: Solo el usuario puede aprobar una desviación; debe quedar
  registrada en `audit.md` con timestamp y en `aidlc-state.md` como excepción.
- **Relación con Security Baseline**: si la extensión `security/baseline` también
  está habilitada, ambas se reportan por separado; ante solape (p. ej. cifrado,
  logging) basta una implementación que satisfaga las dos, citada en ambos
  resúmenes.
