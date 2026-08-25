# Datos fuente

Carpeta para el Excel/CSV de Planificación de Demanda que alimenta `index.html`.

Hoy los datos están embebidos directamente en `assets/js/data.js` (ya calculados: quiebres, bloqueos, riesgos, etc.), sin ningún archivo fuente asociado en el repo.

## `plantilla_datos_quiebres.xlsx`

Plantilla para actualizar esos datos con el detalle completo (SKU × Semana × Planta), en vez de los recortes actuales (top 10 por semana, top 50 de riesgo, 7 productos de merma). Con el detalle completo, los filtros (Tipo, Mes, Semana, Planta, Grupo de Marketing, Categoría) funcionan en todas las secciones del dashboard, no solo en algunas.

Hojas: `Instrucciones`, `Quiebres_Semanal`, `Riesgo_Stock`, `Merma_Vencimiento`, `Listas` (referencia/validación). El detalle de qué va en cada columna está en la hoja `Instrucciones` del propio archivo.

Una vez llena, se usa para reconstruir `assets/js/data.js`.
