# Brief — Rediseño Dashboard de Quiebres Watt's

Documento de traspaso para continuar el trabajo en Claude Code. Resume todo lo conversado y decidido hasta ahora, para que se pueda retomar sin perder contexto.

## 1. Contexto y objetivo original

El dashboard (`reporte_quiebres_mejorado.html`, adjunto) reporta quiebres, bloqueos y riesgos de stock de Watt's, separado por SKU, planta, grupo de marketing y semana. Lo usan **más de 1.000 personas dentro de la empresa, con niveles de conocimiento técnico muy dispares**. El objetivo del rediseño es hacerlo más claro e intuitivo para ese público amplio, sin perder profundidad para quien sí sabe leer los datos en detalle.

## 2. Principio de diseño rector (definido por el usuario, es el criterio maestro)

Toda decisión de diseño debe evaluarse contra esta escalera de tiempo:

- **5 segundos** → ¿Estamos bien o mal?
- **15 segundos** → ¿Dónde está el problema?
- **30 segundos** → ¿Qué SKU / categoría / planta lo está provocando?
- **Después de eso** → ¿Qué debería revisar o hacer la persona?

Cualquier panel o gráfico nuevo debe poder ubicarse en uno de estos 4 pasos. Si no responde ninguna de estas preguntas con claridad, no debería estar arriba en la jerarquía visual.

**Esto todavía no está aplicado al cuerpo principal del dashboard.** Se construyó un mockup de ejemplo (cabecera con semáforo de estado + "dónde" + "qué" + "acción sugerida", con datos reales) que el usuario no alcanzó a confirmar porque pasó directo al punto 5 de este documento (el giro conceptual grande). Es el primer paso pendiente recomendado.

## 3. Cambios ya implementados en `reporte_quiebres_mejorado.html`

- **Navegación separada en dos barras**: la barra roja solo tiene las 4 pestañas de vista (Quiebres / Bloqueos / Combinado / ⚠ Riesgos); los filtros (Tipo, Mes, Semana, Planta, Categoría, Buscar SKU) están en una barra blanca aparte, con etiquetas visibles y botón "Limpiar filtros".
- **Accesos rápidos (quicknav)** arriba de la página para saltar directo a cada sección sin hacer scroll.
- **Glosario/ayuda** (botón "¿Cómo leer este reporte?") que explica en lenguaje simple: Quiebre, Bloqueo, Combinado, FCST, Venta real, Alcance de stock, Crítico/Alerta.
- **Gráfico de "Comportamiento semanal" rediseñado**: se eliminó la tarjeta de semana con una barra de progreso horizontal ("barra de avance") que el usuario consideró poco útil para interpretar datos. Se reemplazó por **un solo gráfico de barras verticales** (una barra por semana), donde la semana seleccionada se resalta y al hacer clic filtra todo el dashboard. Esto respondía al pedido explícito: *"me gustan los gráficos de barra pero verticales que digan el comportamiento semanalmente"*.
- **Limpieza de código muerto**: se eliminó la sección "Evolución Semanal" (canvas con gráfico de línea) y la tabla "Nuevos Críticos" — ninguna de las dos tenía botón de acceso en la interfaz, nunca se mostraban al usuario final.
- **Legibilidad general**: se subieron tamaños de fuente y contraste de textos grises (el original usaba grises muy claros, 10-11px).
- **Pestaña "⚠ Riesgos" reestructurada como "Riesgo Futuro"** con dos ramas explícitas (ver punto 5 y 6):
  - 🔴 **Riesgo de Quiebre** (todo el contenido que ya existía: KPIs de críticos/alertas, desglose por planta, tabla top 50 por menor alcance).
  - 🟠 **Riesgo de Merma** (nueva): usa el dato real de `MERMA_VENC` (productos con vencimiento próximo confirmado) y dice explícitamente que la lista de "candidatos por exceso de stock" **no se puede construir todavía** por falta de datos (ver punto 6).
- **Filtro de Categoría**: agregado a la barra de filtros, pero **su alcance real es solo la tabla de "Top SKUs"** (sección ⑤) — es la única parte del dashboard donde el dato de categoría existe por fila. Los KPIs, el ranking de Grupos de Marketing, el ranking de Plantas y el gráfico de Tendencia **no se pueden filtrar por categoría** porque esos totales vienen pre-agregados sin ese campo (ver punto 6). Se dejó una nota visible en la interfaz aclarando esto para no generar una falsa expectativa.

## 4. Ideas discutidas para "Quiebres por Grupo de Marketing" (pendientes, no implementadas)

El usuario pidió ideas para mejorar esa sección más allá de la barra horizontal simple. Se propusieron y quedaron pendientes de implementar (en orden de prioridad sugerida):

1. **% del FCST más visible** — hoy existe pero como chip pequeño casi escondido; es más relevante que el volumen absoluto porque mide gravedad relativa al tamaño del grupo.
2. **Participación % sobre el total** — cuánto pesa ese grupo en el problema total de la semana (ya existe en la sección de Plantas, falta en Grupos).
3. **Tendencia por grupo** — mini-flecha ▲/▼ o sparkline con las últimas semanas de ese grupo específico.
4. **Vista de cuadrante (Volumen vs. Gravedad)** — se construyó un ejemplo funcional (scatter con % FCST en Y, toneladas en X, tamaño = FCST). **El usuario lo encontró "entretenido" pero no le sirvió para su objetivo real** — no encaja con el principio de 5s/15s/30s porque es una vista de análisis, no de lectura rápida. Se descarta como elemento principal; podría quedar como vista secundaria/opcional para analistas, no como default.
5. **Toggle tabla ordenable** como alternativa a las barras, para quien prefiera comparar números exactos.

## 5. El giro conceptual grande: de "Dashboard de Quiebres" a "Control Tower predictivo"

Esta es la idea más importante que surgió en la conversación y debería guiar cualquier desarrollo futuro serio.

**Cambio de pregunta:** en vez de "¿Cuánto quebramos?" (medida ex-post, ya ocurrida), el dashboard debería preguntar **"¿Estamos encaminados a quebrar o a generar merma?"** (predictivo).

**Dos tipos de riesgo con lógicas de negocio distintas — no un solo semáforo:**

- 🔴 **Riesgo de Quiebre** — especialmente grave en **Abarrotes**. Lógica: "tengo que tener stock de seguridad". El riesgo aparece cuando `Stock proyectado < Stock de seguridad`, y eventualmente `Stock proyectado → 0`.
- 🟠 **Riesgo de Merma** — especialmente grave en **PLF y Quesos** (categorías refrigeradas de vida útil corta). Lógica inversa: "no quiero producir de más porque puedo terminar destruyendo producto". El riesgo aparece cuando `Cobertura de stock > Vida útil restante` (el stock alcanza para más semanas de las que el producto puede esperar antes de vencer).

**Métricas clave propuestas:**

- **Cobertura proyectada** (no solo cobertura actual): comparar stock actual contra el FCST de las *próximas* semanas, no solo la semana actual — un SKU puede verse sano hoy pero acelerar su consumo o su vencimiento pronto.
- **Exceso en riesgo** (para Merma): `Stock actual − Venta proyectada hasta fin de vida útil = kg que probablemente se transformarán en merma`.
- **Risk Score por SKU** con las dos dimensiones (% probabilidad de quiebre, % probabilidad de merma) y una explicación legible del *por qué* (ej: "Stock ↓24%, FCST ↑18%, Cobertura cayendo de 2,4 a 1,3 semanas") + una acción sugerida.
- **Umbrales calibrados con el histórico real**, no arbitrarios (nada de "10%" o "20%" inventado): la idea es mirar, para los SKU que efectivamente quebraron o generaron merma, cómo venían su cobertura/stock/tendencia 1 a 4 semanas antes, y sacar de ahí el umbral real de alerta — distinto por familia (Abarrotes vs. Refrigerados/PLF/Quesos).

## 6. Limitaciones de datos detectadas — honestas y verificadas contra el archivo actual

Antes de prometer nada, se auditó el archivo real y esto es lo que se encontró (importante no pasar por alto esto en el siguiente desarrollo):

- **La serie semanal de quiebres por SKU (`DB_QUIEBRES`, S01–S29) viene recortada a los 10 peores SKU por semana**, no es el universo completo. Esto impide reconstruir la trayectoria de cobertura de un SKU en las semanas previas a un quiebre — en esas semanas probablemente no estaba entre los 10 peores y simplemente no aparece en los datos (sesgo de selección, no "estaba bien").
- **No existe historial de stock/cobertura por SKU.** `RIESGOS` y `PLANTAS_RIESGO` son una **foto única** a una fecha (23-jul-2026), no una serie de tiempo.
- **`RIESGOS` / `PLANTAS_RIESGO` solo contienen SKU que YA están en riesgo de quiebre** (stock bajo, clasificados "crítico" o "alerta"). No incluyen SKU sanos ni SKU con exceso de stock — por construcción, esta fuente **no puede** usarse para detectar sobrestock/merma.
- **`MERMA_VENC` (vencimiento confirmado) solo tiene 7 SKU** — es una lista curada, muy chica, no un barrido completo de vida útil por SKU.
- **No existe campo de "stock de seguridad" objetivo** por SKU ni por categoría en ninguna parte del archivo.
- **Los totales agregados de Grupo de Marketing y Planta (`cadenas[]`, `plantas[]`) no traen el campo categoría** — vienen pre-sumados desde origen. Por eso el filtro de Categoría implementado solo puede aplicarse a la tabla de SKU, no a KPIs ni rankings.
- `MERMAS_YOY` y `MERMAS_META` existen como variables en el archivo pero están **vacías** (`{}`) — funcionalidad planeada por quien construyó el archivo originalmente, nunca se llenó de datos.

**Conclusión:** con el archivo HTML actual **no es posible** construir el Risk Score predictivo ni calibrar umbrales reales. Sí es posible (y ya se hizo) construir la *estructura* correcta (separación Quiebre/Merma) usando la foto actual, dejando explícito en la interfaz que es estado actual y no proyección.

## 7. Qué pedirle al equipo de sistemas / origen de datos para el build completo

Para poder construir el Control Tower predictivo descrito en el punto 5, el siguiente export necesitaría incluir, idealmente en formato tabular (CSV/parquet) en vez de HTML embebido:

1. **Histórico semanal completo por SKU** (no solo top 10): stock disponible, stock bloqueado, FCST de esa semana, planta, categoría — para todas las semanas disponibles, para el universo completo de SKU (no solo los peores).
2. **FCST proyectado a futuro por SKU**, al menos 4 semanas hacia adelante (no solo el FCST de la semana actual).
3. **Stock de seguridad objetivo por SKU o por categoría**, si existe definido en el sistema de planificación.
4. **Vida útil restante / fecha de vencimiento por lote**, vinculada al stock disponible de cada SKU — para poder calcular cobertura vs. vida útil en toda la base, no solo en los 7 casos ya curados.
5. Idealmente, los totales agregados de Grupo de Marketing y Planta **desglosados también por categoría**, para que el filtro de Categoría pueda aplicarse a todo el dashboard y no solo a la tabla de SKU.

Con eso, el siguiente paso analítico sería: para cada SKU que históricamente quebró o generó merma, mirar sus indicadores 1–4 semanas antes del evento, separado por familia (Abarrotes vs. Refrigerados/PLF/Quesos), y derivar umbrales de alerta basados en comportamiento real.

## 8. Archivos de esta conversación

- **`reporte_quiebres_mejorado.html`** — el dashboard con todos los cambios del punto 3 ya aplicados. Es el punto de partida para seguir trabajando.
- Se construyeron dos mockups de ejemplo durante la conversación (no entregados como archivo, solo mostrados como captura): uno de vista de cuadrante (descartado, punto 4) y uno de cabecera 5s/15s/30s/Acción (pendiente de integrar, punto 2). Si se necesitan, se pueden reconstruir a partir de este brief — las especificaciones están en los puntos 2 y 4.

## 9. Siguiente paso recomendado

En este orden:

1. Integrar la cabecera 5s/15s/30s/Acción al inicio del dashboard (punto 2), reemplazando o complementando los KPIs actuales de la sección Consolidado.
2. Mejorar la sección "Quiebres por Grupo de Marketing" con %FCST visible, participación y tendencia (punto 4, ítems 1-3).
3. Si se consigue el export de datos ampliado (punto 7), construir el Risk Score predictivo real (punto 5) y reemplazar los umbrales fijos por umbrales calibrados con el histórico.
