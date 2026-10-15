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

## Forecast Mes +1

`forecast_mes1/` genera cada mes una página para revisar el forecast del próximo mes
contra SOP, Sell In del mismo mes del año anterior, ritmo del año actual, sesgo reciente,
precios y promos.

```
python3 forecast_mes1/build_forecast_mes1.py FCST_Lactes_y_Jugos.xlsx --mes 12 --anio 2026
```

Lee las hojas `FCST` (semanas S## y columna `SOP <MES>`) y `Precio vs SellIn 25-26`.
Deja la página en `forecast_mes1/output/forecast_<anio>_<mes>.html` (no se versiona).

Para incluir promos de Cencosud diferenciadas Jumbo / Santa Isabel:

```
# en la página (sin tocar el Excel)
python3 forecast_mes1/build_forecast_mes1.py FCST.xlsx --mes 12 --anio 2026 \
    --promo-cenco promo_cenco.xlsx --promo-nombre "Promo Cencosud Dic." --promo-duracion "Diciembre 2026"

# en una copia del Excel (hoja FCST + nota en Leyenda)
python3 forecast_mes1/cargar_promo_cencosud.py FCST.xlsx promo_cenco.xlsx \
    --nombre "Promo Cencosud Dic." --duracion "Diciembre 2026" --out FCST_actualizado.xlsx
```

La copia del Excel pierde los valores calculados de las fórmulas: al abrirla en Excel
hay que recalcular y, si lo pide, actualizar los vínculos (por ejemplo, 'Rolling 2026').
