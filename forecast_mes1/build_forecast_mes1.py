"""Genera la página "Forecast Mes +1" a partir del Excel FCST Lácteos y Jugos.

Uso:
    python3 forecast_mes1/build_forecast_mes1.py ARCHIVO.xlsx --mes 11 --anio 2026

Lee:
  - Hoja "FCST": forecast semanal por SKU x subcadena (columnas S##) y la
    columna "SOP <MES>" (para noviembre, columna BB).
  - Hoja "Precio vs SellIn 25-26": precio, Sell In y Sell Out semanal por
    SKU x subcadena para el año anterior y el actual.

Escribe forecast_mes1/output/forecast_<anio>_<mes>.html (página autocontenida).
"""

import argparse
import calendar
import datetime as dt
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import openpyxl

MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]
MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
INFLACION = 0.041          # inflación anual estimada (misma que la hoja Leyenda)
SEMANAS_RUNRATE = 8        # semanas recientes para el ritmo actual
YOY_MIN, YOY_MAX = 0.3, 3.0
# Suavizado por SKU×cadena hacia el promedio de su cadena (los SKU chicos son ruidosos):
K_YOY = 30.0               # t de Sell In (semanas de comparación) que "pesa" el ritmo de la cadena
K_ESTAC = 2.0              # t/semana que "pesa" la estacionalidad de la cadena
ESTAC_MIN, ESTAC_MAX = 0.6, 1.6

AQUI = Path(__file__).resolve().parent


def pesos_mes(anio, mes):
    """Peso de cada semana ISO dentro del mes: días de la semana que caen en el mes / 7."""
    pesos = defaultdict(float)
    for d in range(1, calendar.monthrange(anio, mes)[1] + 1):
        pesos[dt.date(anio, mes, d).isocalendar()[1]] += 1 / 7
    return dict(pesos)


def num(v):
    return float(v) if isinstance(v, (int, float)) else 0.0


def leer_fcst(wb, mes):
    ws = wb["FCST"]
    filas = list(ws.iter_rows(values_only=True))
    h = [str(c).strip() if c is not None else "" for c in filas[0]]
    idx = {n: i for i, n in enumerate(h) if n}
    semanas = {int(n[1:]): i for n, i in idx.items() if re.fullmatch(r"S\d{1,2}", n)}
    col_sop = idx.get(f"SOP {MESES[mes - 1]}")
    if col_sop is None:
        sys.exit(f"No encontré la columna 'SOP {MESES[mes - 1]}' en la hoja FCST")
    col = lambda n: idx.get(n)
    out = []
    for r in filas[1:]:
        sku = r[idx["SAP"]]
        if not isinstance(sku, (int, float)):
            continue  # filas TOTAL
        g = lambda n: r[col(n)] if col(n) is not None else None
        out.append({
            "sku": int(sku),
            "producto": g("Nombre Producto"),
            "subcat": g("Subcateria"),
            "gerencia": g("GERENCIA"),
            "cadena": g("Cadena"),
            "subcadena": g("SubCadena Cliente"),
            "semanas": {w: num(r[i]) for w, i in semanas.items()},
            "sop": num(r[col_sop]),
            "promo": g("Nombre Promo"),
            "promo_dur": g("Duración Promo"),
            "vol_pactado": num(g("Volumen Pactado (Ton)")),
            "alcance": g("Alcance (sem)"),
        })
    return out, sorted(semanas)


def leer_precios(wb, anio):
    ws = wb["Precio vs SellIn 25-26"]
    filas = ws.iter_rows(values_only=True)
    h = [str(c).strip() if c is not None else "" for c in next(filas)]
    idx = {n: i for i, n in enumerate(h)}
    a, b = anio - 1, anio
    need = [f"Precio {a}", f"Sell In {a} (Ton)", f"Sell Out {a} (Ton)",
            f"Precio {b}", f"Sell In {b} (Ton)", f"Sell Out {b} (Ton)"]
    for n in need:
        if n not in idx:
            sys.exit(f"Falta la columna '{n}' en la hoja de precios")
    # (sku, subcadena) -> semana -> dict
    hist = defaultdict(dict)
    for r in filas:
        if not isinstance(r[idx["SKU"]], (int, float)):
            continue
        hist[(int(r[idx["SKU"]]), r[idx["SubCadena"]])][int(r[idx["Semana"]])] = {
            "p0": r[idx[need[0]]], "si0": r[idx[need[1]]], "so0": r[idx[need[2]]],
            "p1": r[idx[need[3]]], "si1": r[idx[need[4]]], "so1": r[idx[need[5]]],
        }
    return hist


def promo_vigente(nombre, dur, anio, mes):
    """Heurística: descarta promos cuya duración nombra un mes anterior o termina antes del mes."""
    if not nombre:
        return False
    texto = str(dur or "").lower()
    for i, m in enumerate(MESES_LARGO, start=1):
        if m in texto and f"{m} {anio}" in texto and i < mes and "desde" not in texto:
            return False
    rango = re.search(r"(\d{1,2})\.(\d{1,2})\s*a\s*(\d{1,2})\.(\d{1,2})", texto)
    if rango:
        ini_m, fin_m = int(rango.group(2)), int(rango.group(4))
        meses = list(range(ini_m, fin_m + 1)) if fin_m >= ini_m else list(range(ini_m, 13)) + list(range(1, fin_m + 1))
        return mes in meses
    return True


def aplicar_promo_cenco(fcst, promo):
    """Misma regla que cargar_promo_cencosud.py: reemplaza la promo Cencosud anterior en Jumbo / Santa Isabel."""
    for f in fcst:
        if f["subcadena"] not in ("JUMBO", "SANTA ISABEL"):
            continue
        if isinstance(f["promo"], str) and f["promo"].startswith("Promo Cencosud"):
            f["promo"], f["promo_dur"], f["vol_pactado"] = None, None, 0.0
        p = promo["datos"].get(f["sku"])
        if p and p.get(f["subcadena"], 0) > 0:
            f["promo"], f["promo_dur"], f["vol_pactado"] = promo["nombre"], promo["duracion"], round(p[f["subcadena"]], 3)


def construir(xlsx, anio, mes, promo=None):
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    fcst, semanas_fcst = leer_fcst(wb, mes)
    if promo:
        aplicar_promo_cenco(fcst, promo)
    hist = leer_precios(wb, anio)

    w_act = pesos_mes(anio, mes)
    w_ant = pesos_mes(anio - 1, mes)
    ult_fcst = max(semanas_fcst)
    proxy = [w for w in w_act if w not in semanas_fcst]

    sem_reales = sorted({w for d in hist.values() for w, v in d.items() if v["si1"] is not None})
    ult_real = max(sem_reales)
    sem_yoy = [w for w in sem_reales]
    sem_rr = [w for w in sem_reales if w > ult_real - SEMANAS_RUNRATE]
    dias_mes = calendar.monthrange(anio, mes)[1]

    sem_overlap = [w for w in semanas_fcst if w in sem_reales]

    def sesgo(sem_fcst, h):
        """FCST vs Sell In real en las semanas donde hay ambos (+ = el forecast venía alto)."""
        f = sum(sem_fcst.get(w, 0) for w in sem_overlap)
        r = sum(num(h.get(w, {}).get("si1")) for w in sem_overlap)
        return {"sesgo": f / r - 1 if r > 0 else None, "ov_fcst": f, "ov_real": r}

    def fcst_mes(sem):
        return sum(p * sem.get(w if w in sem else ult_fcst, 0) for w, p in w_act.items())

    # ---- agregación por SKU ----
    skus = {}
    for f in fcst:
        s = skus.setdefault(f["sku"], {
            "sku": f["sku"], "producto": f["producto"], "subcat": f["subcat"],
            "sop": f["sop"], "fcst": 0.0, "fcst_ret": 0.0,
            "fcst_sem": defaultdict(float), "fcst_sem_ret": defaultdict(float),
            "cadenas": {}, "promos": [],
        })
        fm = fcst_mes(f["semanas"])
        s["fcst"] += fm
        for w, v in f["semanas"].items():
            s["fcst_sem"][w] += v
        key = (f["sku"], f["subcadena"])
        c = s["cadenas"].setdefault(f["subcadena"], {"subcadena": f["subcadena"], "fcst": 0.0,
                                                     "sem": defaultdict(float), "retail": key in hist})
        c["fcst"] += fm
        for w, v in f["semanas"].items():
            c["sem"][w] += v
        if key in hist:
            s["fcst_ret"] += fm
            for w, v in f["semanas"].items():
                s["fcst_sem_ret"][w] += v
        if f["promo"]:
            s["promos"].append({
                "cadena": f["subcadena"], "nombre": str(f["promo"]),
                "duracion": f["promo_dur"].strftime("%d-%m-%Y") if isinstance(f["promo_dur"], dt.datetime) else (str(f["promo_dur"]) if f["promo_dur"] else ""),
                "vol": f["vol_pactado"] or None,
                "vigente": promo_vigente(f["promo"], f["promo_dur"], anio, mes),
            })

    def metricas(h_por_sem, prior=None):
        """h_por_sem: semana -> dict sumado (si0, si1, so0, so1, p0w, p1w, q0, q1).
        prior: {"yoy", "estac"} de la cadena para suavizar los factores de un SKU."""
        g = lambda w, k: h_por_sem.get(w, {}).get(k, 0.0)
        si_mes_ant = sum(p * g(w, "si0") for w, p in w_ant.items())
        so_mes_ant = sum(p * g(w, "so0") for w, p in w_ant.items())
        base_ant = sum(g(w, "si0") for w in sem_yoy)
        base_act = sum(g(w, "si1") for w in sem_yoy)
        yoy = base_act / base_ant if base_ant > 0 else None
        rr_act = sum(g(w, "si1") for w in sem_rr) / len(sem_rr)
        rr_ant = sum(g(w, "si0") for w in sem_rr) / len(sem_rr)
        estac = (si_mes_ant / (dias_mes / 7)) / rr_ant if rr_ant > 0 and si_mes_ant > 0 else None
        yoy_s, estac_s = yoy, estac
        if prior:
            if prior.get("yoy") and base_ant > 0:
                yoy_s = (base_act + K_YOY * prior["yoy"]) / (base_ant + K_YOY)
            if prior.get("estac") and rr_ant > 0 and si_mes_ant > 0:
                estac_s = (si_mes_ant / (dias_mes / 7) + K_ESTAC * prior["estac"]) / (rr_ant + K_ESTAC)
        if estac_s:
            estac_s = min(max(estac_s, ESTAC_MIN), ESTAC_MAX)
        yoy_c = min(max(yoy_s, YOY_MIN), YOY_MAX) if yoy_s else None
        estac = estac_s
        metA = si_mes_ant * yoy_c if (yoy_c and si_mes_ant > 0) else None
        metB = rr_act * (estac if estac else 1.0) * dias_mes / 7 if rr_act > 0 else None
        refs = [m for m in (metA, metB) if m is not None]
        ref = sum(refs) / len(refs) if refs else (0.0 if base_act == 0 and si_mes_ant == 0 else None)
        # precios: promedio ponderado por volumen
        def precio(semanas, kp, kq):
            num_ = sum(g(w, kp) for w in semanas)
            den = sum(g(w, kq) for w in semanas)
            return num_ / den if den > 0 else None
        p_ant = precio(list(w_ant), "p0w", "q0")
        ult_p = [w for w in sem_reales if g(w, "q1") > 0]
        p_act = precio(ult_p[-2:], "p1w", "q1") if ult_p else None
        dp_nom = p_act / p_ant - 1 if (p_act and p_ant) else None
        dp_real = (1 + dp_nom) / (1 + INFLACION) - 1 if dp_nom is not None else None
        return {
            "si_mes_ant": si_mes_ant, "so_mes_ant": so_mes_ant, "yoy": yoy,
            "rr": rr_act * dias_mes / 7, "estac": estac, "metA": metA, "metB": metB, "ref": ref,
            "p_ant": p_ant, "p_act": p_act, "dp_nom": dp_nom, "dp_real": dp_real,
        }

    def acumular(destino, semanas_h):
        for w, v in semanas_h.items():
            d = destino.setdefault(w, defaultdict(float))
            si0, si1 = num(v["si0"]), num(v["si1"])
            d["si0"] += si0; d["si1"] += si1
            d["so0"] += num(v["so0"]); d["so1"] += num(v["so1"])
            # para precio ponderado usamos peso = sell in (o 1 si no hubo venta)
            if isinstance(v["p0"], (int, float)):
                q = si0 if si0 > 0 else 0.001
                d["p0w"] += v["p0"] * q; d["q0"] += q
            if isinstance(v["p1"], (int, float)):
                q = si1 if si1 > 0 else 0.001
                d["p1w"] += v["p1"] * q; d["q1"] += q

    total_h = {}
    cadena_h = defaultdict(dict)
    salida = []
    pre = defaultdict(dict)
    for s in skus.values():
        for c in s["cadenas"].values():
            if (s["sku"], c["subcadena"]) in hist:
                acumular(pre[c["subcadena"]], hist[(s["sku"], c["subcadena"])])
    priors = {cad: {k: m[k] for k in ("yoy", "estac")} for cad, h in pre.items() for m in [metricas(h)]}
    for s in skus.values():
        h_sku = {}
        cads = []
        for c in s["cadenas"].values():
            hc = hist.get((s["sku"], c["subcadena"]))
            row = {"subcadena": c["subcadena"], "fcst": c["fcst"], "retail": c["retail"],
                   "sem_fcst": {w: round(v, 3) for w, v in c["sem"].items()}}
            if hc:
                h1 = {}
                acumular(h1, hc)
                acumular(h_sku, hc)
                acumular(total_h, hc)
                acumular(cadena_h[c["subcadena"]], hc)
                row.update(metricas(h1, priors.get(c["subcadena"])))
                row.update(sesgo(c["sem"], h1))
            cads.append(row)
        m = metricas(h_sku) if h_sku else {}
        if h_sku:
            m.update(sesgo(s["fcst_sem_ret"], h_sku))
        prev = [w for w in semanas_fcst if w < min(w_act) and w >= min(w_act) - 4]
        prom_prev = sum(s["fcst_sem"].get(w, 0) for w in prev) / len(prev) if prev else 0
        prom_mes = s["fcst"] / (dias_mes / 7)
        salida.append({
            "sku": s["sku"], "producto": s["producto"], "subcat": s["subcat"],
            "fcst": s["fcst"], "sop": s["sop"], "fcst_ret": s["fcst_ret"],
            "uplift": prom_mes / prom_prev - 1 if prom_prev > 0 else None,
            "promos": s["promos"], "cadenas": sorted(cads, key=lambda x: -x["fcst"]),
            "sem_fcst": {w: round(v, 3) for w, v in s["fcst_sem_ret"].items()},
            "sem_hist": {w: {k: round(v.get(k, 0), 3) for k in ("si0", "si1", "so0", "so1")} |
                         {"p0": (v["p0w"] / v["q0"]) if v.get("q0") else None,
                          "p1": (v["p1w"] / v["q1"]) if v.get("q1") else None}
                         for w, v in sorted(h_sku.items())},
            **m,
        })

    # totales por cadena (solo retail con historia)
    por_cadena = []
    for cad, h in cadena_h.items():
        f_c = sum(c["fcst"] for s in salida for c in s["cadenas"] if c["subcadena"] == cad)
        ref_c = sum((c.get("ref") or 0) for s in salida for c in s["cadenas"] if c["subcadena"] == cad)
        m = metricas(h)
        m.update(sesgo({w: sum(c["sem_fcst"].get(w, 0) for s in salida for c in s["cadenas"] if c["subcadena"] == cad)
                        for w in sem_overlap}, h))
        por_cadena.append({"subcadena": cad, "fcst": f_c, "ref_sum": ref_c, **m})
    fcst_no_ret = defaultdict(float)
    for f in fcst:
        if (f["sku"], f["subcadena"]) not in hist:
            fcst_no_ret[f["subcadena"]] += fcst_mes(f["semanas"])
    fcst_no_ret = {k: v for k, v in fcst_no_ret.items() if v > 0.05}

    sem_fcst_total = defaultdict(float)
    for s in salida:
        for w, v in s["sem_fcst"].items():
            sem_fcst_total[w] += v

    return {
        "anio": anio, "mes": mes, "mes_nombre": MESES_LARGO[mes - 1], "mes_abrev": MESES[mes - 1],
        "dias_mes": dias_mes,
        "archivo": Path(xlsx).name.split("-", 1)[-1] if re.match(r"^[0-9a-f]{8}-", Path(xlsx).name) else Path(xlsx).name,
        "generado": dt.date.today().strftime("%d-%m-%Y"),
        "pesos_act": {w: round(p, 4) for w, p in sorted(w_act.items())},
        "pesos_ant": {w: round(p, 4) for w, p in sorted(w_ant.items())},
        "proxy_semanas": proxy, "ult_fcst": ult_fcst,
        "ult_real": ult_real, "sem_yoy": [min(sem_yoy), max(sem_yoy)], "sem_rr": [min(sem_rr), max(sem_rr)],
        "semanas_fcst": semanas_fcst,
        "skus": sorted(salida, key=lambda x: -x["fcst"]),
        "cadenas": sorted(por_cadena, key=lambda x: -x["fcst"]),
        "no_retail": sorted(({"subcadena": k, "fcst": v} for k, v in fcst_no_ret.items()), key=lambda x: -x["fcst"]),
        "total": metricas(total_h) | sesgo(sem_fcst_total, total_h),
        "sem_overlap": [min(sem_overlap), max(sem_overlap)] if sem_overlap else None,
        "total_sem": {w: {k: round(v.get(k, 0), 2) for k in ("si0", "si1", "so0", "so1")} for w, v in sorted(total_h.items())},
        "total_sem_fcst": {w: round(v, 2) for w, v in sorted(sem_fcst_total.items())},
    }


def redondear(o):
    if isinstance(o, float):
        return round(o, 4)
    if isinstance(o, dict):
        return {str(k): redondear(v) for k, v in o.items()}
    if isinstance(o, list):
        return [redondear(v) for v in o]
    return o


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("xlsx")
    hoy = dt.date.today()
    sig = (hoy.replace(day=1) + dt.timedelta(days=32))
    ap.add_argument("--mes", type=int, default=sig.month, help="mes a proyectar (por defecto, el próximo)")
    ap.add_argument("--anio", type=int, default=sig.year)
    ap.add_argument("--out", default=None)
    ap.add_argument("--promo-cenco", default=None, help="archivo de promos Cencosud diferenciado Jumbo / Santa Isabel")
    ap.add_argument("--promo-nombre", default=None)
    ap.add_argument("--promo-duracion", default=None)
    a = ap.parse_args()

    promo = None
    if a.promo_cenco:
        from cargar_promo_cencosud import leer_promo
        promo = {"datos": leer_promo(a.promo_cenco),
                 "nombre": a.promo_nombre or f"Promo Cencosud {MESES[a.mes - 1].capitalize()}.",
                 "duracion": a.promo_duracion or f"{MESES_LARGO[a.mes - 1].capitalize()} {a.anio}"}
    datos = redondear(construir(a.xlsx, a.anio, a.mes, promo))
    plantilla = (AQUI / "plantilla.html").read_text(encoding="utf-8")
    html = plantilla.replace("/*__DATOS__*/null", json.dumps(datos, ensure_ascii=False, separators=(",", ":")))
    html = html.replace("__TITULO__", f"Forecast {MESES_LARGO[a.mes - 1].capitalize()} {a.anio}")
    out = Path(a.out) if a.out else AQUI / "output" / f"forecast_{a.anio}_{a.mes:02d}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    t = datos["total"]
    print(f"OK -> {out}  ({len(datos['skus'])} SKU)")
    print(f"FCST {sum(s['fcst'] for s in datos['skus']):.0f} t | SOP {sum(s['sop'] for s in datos['skus']):.0f} t | "
          f"FCST retail {sum(s['fcst_ret'] for s in datos['skus']):.0f} t | Ref retail {sum((s.get('ref') or 0) for s in datos['skus']):.0f} t | "
          f"Sell In {a.mes}/{a.anio - 1} retail {t['si_mes_ant']:.0f} t | YoY {t['yoy']:.2f}")


if __name__ == "__main__":
    main()
