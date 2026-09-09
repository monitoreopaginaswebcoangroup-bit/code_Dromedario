# Opt-In: Enterdev Security — OWASP Top 10

> Este archivo se carga siempre al inicio del workflow. El archivo de reglas
> completo (`owasp-top10.md`) SOLO se carga si el usuario opta por aplicar
> la extensión (opciones A o B).

## Presentation (mostrar durante Requirements Analysis)

**ENTERDEV S.A.S. — Extensión de Seguridad OWASP Top 10**

Este proyecto puede desarrollarse bajo la extensión de seguridad Enterdev basada en
el **OWASP Top 10 (2021)**, que convierte cada categoría de riesgo en reglas
verificables y bloqueantes a lo largo del ciclo de vida:

- **Diseño**: modelado de amenazas ligero y controles de acceso definidos por
  historia de usuario (A01, A04).
- **Implementación**: criptografía correcta, prevención de inyección, configuración
  segura y dependencias sanas (A02, A03, A05, A06).
- **Operación**: autenticación robusta, integridad de software, logging de seguridad
  y protección SSRF (A07, A08, A09, A10).
- **Gobernanza**: resumen de cumplimiento por categoría OWASP en cada etapa aplicable.

## Question

**Q1**: ¿Deseas aplicar la extensión de seguridad OWASP Top 10 a este proyecto?

A) **Sí — completa** — todas las categorías A01–A10 como restricciones bloqueantes
   (recomendado para aplicaciones productivas)
B) **Sí — parcial** — indica tras [Answer]: qué categorías aplicar (ej. "B: A01,A03,A09");
   las demás se reportan como N/A
C) **No aplicar** — sin reglas OWASP en este proyecto (solo PoCs o prototipos desechables)

[Answer]:

## On Answer (instrucciones para el agente)

- **Si la respuesta es A o B**:
  1. Cargar el archivo de reglas completo `owasp-top10.md` (mismo directorio).
  2. Registrar en `aidlc-docs/aidlc-state.md`:

     ```markdown
     ## Extension Configuration
     - Extension: owasp-top10
     - Enabled: true
     - Scope: FULL   # A → FULL | B → lista de categorías (ej. A01,A03,A09)
     ```

  3. Registrar la respuesta completa del usuario en `audit.md` con timestamp.
  4. En modo parcial (B), las categorías no listadas se reportan como N/A en el
     resumen de cumplimiento (no son blocking).

- **Si la respuesta es C**:
  1. NO cargar `owasp-top10.md` (ahorro de contexto).
  2. Registrar en `aidlc-docs/aidlc-state.md`:

     ```markdown
     ## Extension Configuration
     - Extension: owasp-top10
     - Enabled: false
     ```

  3. Registrar la decisión en `audit.md` con timestamp.

- **Ambigüedad**: si el usuario responde algo distinto a A/B/C, o elige B sin listar
  categorías válidas (A01–A10), re-preguntar usando el mismo formato de opción
  múltiple antes de continuar.
