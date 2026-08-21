# Dashboard de Quiebres — Watt's

Reporte de quiebres, bloqueos y riesgo de stock, separado por SKU, planta, grupo de marketing y semana.

## Estructura

```
index.html            página principal (markup)
assets/css/styles.css  estilos
assets/js/data.js      datos del reporte (constantes generadas desde Planificación de Demanda)
assets/js/app.js       lógica de filtros, tablas y gráficos
data/                  Excel/CSV fuente (aún no cargado — ver data/README.md)
brief_dashboard_quiebres.md  brief de contexto y próximos pasos
```

## Ver el dashboard

Abrir `index.html` en un navegador (o servirlo con cualquier servidor estático — usa rutas relativas a `assets/`).
