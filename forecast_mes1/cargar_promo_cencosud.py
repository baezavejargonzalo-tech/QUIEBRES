"""Carga las promos de Cencosud (Jumbo / Santa Isabel) en la hoja FCST.

Uso:
    python3 forecast_mes1/cargar_promo_cencosud.py FCST.xlsx promo_cenco.xlsx --nombre "Promo Cencosud Nov." --duracion "Noviembre 2026" --out FCST_actualizado.xlsx

- Solo toca filas de la hoja FCST con SubCadena JUMBO o SANTA ISABEL y SKU presente en el forecast.
- Reemplaza la promo Cencosud anterior (nombre que empieza con "Promo Cencosud"); no toca otras promos.
- El archivo de promos trae dos pares de columnas JUMBO / SANTA ISABEL: el primero en unidades
  y el segundo en kilos. Se usa el segundo (kg) y se pasa a toneladas.
- La promo se asigna a la subcadena que tiene volumen (> 0), ya diferenciada; no se reparte 50/50.
"""

import argparse
import datetime as dt

import openpyxl

SUBCADENAS = ("JUMBO", "SANTA ISABEL")


def kg(v):
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v or "").replace("\xa0", "").strip()
    if s in ("", "-"):
        return 0.0
    return float(s.replace(".", "").replace(",", "."))


def leer_promo(path):
    ws = openpyxl.load_workbook(path, data_only=True).active
    filas = list(ws.iter_rows(values_only=True))
    # fila de encabezado: la que contiene "SAP"
    hi = next(i for i, r in enumerate(filas) if r and any(isinstance(c, str) and "SAP" in c for c in r))
    h = filas[hi]
    cols = [i for i, c in enumerate(h) if c in SUBCADENAS]
    kg_cols = {h[i]: i for i in cols[len(cols) // 2:]}   # segundo par = kilos
    out = {}
    for r in filas[hi + 1:]:
        if not isinstance(r[0], (int, float)):
            continue
        out[int(r[0])] = {"producto": r[1], "formato": r[2],
                          **{sc: kg(r[i]) / 1000 for sc, i in kg_cols.items()}}
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("fcst")
    ap.add_argument("promo")
    ap.add_argument("--nombre", required=True)
    ap.add_argument("--duracion", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    promo = leer_promo(a.promo)
    wb = openpyxl.load_workbook(a.fcst)
    ws = wb["FCST"]
    h = {str(c.value).strip(): c.column for c in ws[1] if c.value is not None}
    c_sku, c_sub = h["SAP"], h["SubCadena Cliente"]
    c_nom, c_dur, c_vol = h["Nombre Promo"], h["Duración Promo"], h["Volumen Pactado (Ton)"]

    en_fcst, borradas, cargadas = set(), 0, []
    for row in range(2, ws.max_row + 1):
        sku, sub = ws.cell(row, c_sku).value, ws.cell(row, c_sub).value
        if not isinstance(sku, (int, float)) or sub not in SUBCADENAS:
            continue
        sku = int(sku)
        en_fcst.add(sku)
        nom = ws.cell(row, c_nom).value
        if isinstance(nom, str) and nom.startswith("Promo Cencosud"):
            for c in (c_nom, c_dur, c_vol):
                ws.cell(row, c).value = None
            borradas += 1
        p = promo.get(sku)
        if p and p.get(sub, 0) > 0:
            ws.cell(row, c_nom).value = a.nombre
            ws.cell(row, c_dur).value = a.duracion
            ws.cell(row, c_vol).value = round(p[sub], 3)
            cargadas.append((sku, sub, p[sub]))

    sin_fcst = [p["producto"] for s, p in promo.items() if s not in en_fcst]
    sin_vol = [p["producto"] for s, p in promo.items() if s in en_fcst and "Y" in str(p["formato"]).split()
               and not all(p.get(sc, 0) > 0 for sc in SUBCADENAS)]

    if "Leyenda" in wb.sheetnames:
        ly = wb["Leyenda"]
        hoy = dt.date.today().strftime("%d-%m-%Y")
        notas = [None, f"Actualización {hoy} — {a.nombre}:",
                 f"- Promo Cencosud reemplazada con el archivo diferenciado Jumbo / Santa Isabel ({a.duracion}). "
                 f"Ya no se reparte 50/50: cada subcadena lleva su propio volumen pactado (kg del archivo ÷ 1000).",
                 f"- {len({s for s, _, _ in cargadas})} SKU del forecast con promo ({len(cargadas)} filas SKU×subcadena, "
                 f"{sum(v for _, _, v in cargadas):.1f} Ton pactadas). Se limpiaron {borradas} filas con la promo Cencosud anterior.",
                 f"- {len(sin_fcst)} SKU del archivo de promos no están en el forecast y no se cargaron."]
        if sin_vol:
            notas.append("- Formato 'Jumbo y Santa Isabel' pero con volumen en una sola subcadena: " + "; ".join(sin_vol) + ".")
        r0 = ly.max_row + 1
        for i, t in enumerate(notas):
            ly.cell(r0 + i, 1).value = t

    wb.save(a.out)
    print(f"Cargadas {len(cargadas)} filas ({len({s for s, _, _ in cargadas})} SKU), "
          f"{sum(v for _, _, v in cargadas):.2f} Ton. Limpiadas {borradas} filas de la promo anterior.")
    for sku, sub, v in sorted(cargadas):
        print(f"  {sku} {sub:12s} {v:7.3f} t")
    print(f"SKU de la promo fuera del forecast: {len(sin_fcst)}")
    print("Con volumen en una sola subcadena pese a formato 'J y SI':", sin_vol)


if __name__ == "__main__":
    main()
