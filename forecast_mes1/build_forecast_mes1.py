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
    """Peso de cada semana ISO dentro del mes, con semana de lunes a sábado:
    días hábiles (lun–sáb) de la semana que caen en el mes / 6. El domingo no cuenta.
    Noviembre 2026 = S45 + S46 + S47 + S48 + S49 × 1/6."""
    pesos = defaultdict(float)
    for d in range(1, calendar.monthrange(anio, mes)[1] + 1):
        f = dt.date(anio, mes, d)
        if f.weekday() < 6:
            pesos[f.isocalendar()[1]] += 1 / 6
    return {w: p for w, p in pesos.items() if p > 1e-9}


# Canales sin historia en la hoja de precios que se toman del archivo de venta real (TP):
# FCST "CANAL TRADICIONAL" = gerencia TRADICIONAL Y REGIONES (incluye Operadores y Mayoristas), sin Alvi.
CLAVE_NO_PROMO = re.compile(r"^[A-Z]+\d{8}$")   # p. ej. "JUNAEB30002065": clave de búsqueda, no una promo
ELAST_TAU = 1.0                  # cuánto se confía en la elasticidad propia de la subcategoría vs la general
ELAST_MIN, ELAST_MAX = -3.5, 0.0
DP_MAX = 0.30                    # tope al Δ precio real usado para el efecto precio


def elasticidades(hist, subcat_de):
    """Elasticidad precio del Sell Out por subcategoría con las semanas del año anterior
    (log volumen vs log precio dentro de cada SKU×cadena), suavizada hacia la general."""
    import math
    por_sub = defaultdict(list)
    for (sku, sub), sem in hist.items():
        pts = [(math.log(v["p0"]), math.log(v["so0"])) for v in sem.values()
               if isinstance(v["p0"], (int, float)) and v["p0"] > 0 and isinstance(v["so0"], (int, float)) and v["so0"] > 0]
        if len(pts) < 10:
            continue
        mp = sum(a for a, _ in pts) / len(pts)
        mq = sum(b for _, b in pts) / len(pts)
        por_sub[subcat_de.get(sku)].extend((a - mp, b - mq) for a, b in pts)
    todos = [x for v in por_sub.values() for x in v]
    sxx = sum(a * a for a, _ in todos)
    e_pool = sum(a * b for a, b in todos) / sxx if sxx else -1.0
    out = {}
    for sc, pts in por_sub.items():
        sxx = sum(a * a for a, _ in pts)
        if sc is None or sxx < 1e-6 or len(pts) < 30:
            continue
        e = sum(a * b for a, b in pts) / sxx
        se = (sum((b - e * a) ** 2 for a, b in pts) / (len(pts) - 1) / sxx) ** 0.5
        w = ELAST_TAU ** 2 / (ELAST_TAU ** 2 + se ** 2)
        out[sc] = {"bruta": e, "se": se, "n": len(pts),
                   "usada": min(max(w * e + (1 - w) * e_pool, ELAST_MIN), ELAST_MAX)}
    return out, min(max(e_pool, ELAST_MIN), ELAST_MAX)


def elasticidad_yoy(path):
    """Comparación entre SKU×cadena de un mismo mes en dos años (archivo TP mensual):
    log(Δ volumen Sell Out) vs log(Δ precio), ponderado por volumen. Sirve de control."""
    import math
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    filas = wb.worksheets[0].iter_rows(values_only=True)
    h = {str(c).strip(): i for i, c in enumerate(next(filas)) if c is not None}
    iso, ip, isk, isub, ia, im = (h["Venta Fisica Sell Out (TON)"], h["Precio Promedio SO"], h["SKU"],
                                  h["SubCadena Cliente"], h["Año"], h["Mes"])
    acc = defaultdict(lambda: [0.0, 0.0])
    anios, mes = set(), None
    for r in filas:
        if not isinstance(r[ia], (int, float)) or not isinstance(r[ip], (int, float)) or not isinstance(r[iso], (int, float)) or r[iso] <= 0:
            continue
        k = (r[isk], r[isub], int(r[ia]))
        acc[k][0] += r[iso]; acc[k][1] += r[ip] * r[iso]
        anios.add(int(r[ia])); mes = int(r[im])
    if len(anios) < 2:
        return None
    a0, a1 = min(anios), max(anios)
    pts = []
    for (sku, sub, a), (q, pw) in acc.items():
        if a != a0 or (sku, sub, a1) not in acc:
            continue
        q1, pw1 = acc[(sku, sub, a1)]
        if q > 1 and q1 > 0.3:
            lp, lv = math.log((pw1 / q1) / (pw / q)), math.log(q1 / q)
            if abs(lp) < 0.4 and abs(lv) < 1.5:
                pts.append((lp, lv, q ** 0.5))
    sw = sum(w for *_, w in pts)
    mp = sum(a * w for a, _, w in pts) / sw
    mv = sum(b * w for _, b, w in pts) / sw
    e = sum(w * (a - mp) * (b - mv) for a, b, w in pts) / sum(w * (a - mp) ** 2 for a, _, w in pts)
    return {"e": e, "n": len(pts), "mes": mes, "anios": [a0, a1]}


def leer_venta_real(path):
    """Sell In real por SKU y semana para Canal Tradicional. Solo VENTA NORMAL
    (se excluyen venta intermedia y liquidación, que son salidas de stock y no demanda)."""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    filas = wb.worksheets[0].iter_rows(values_only=True)
    h = {str(c).strip(): i for i, c in enumerate(next(filas)) if c is not None}
    ig, ic, it, isk, iw, isi, ia = (h["Gerencia de Venta"], h["Cadena Cliente"], h["Tipo de Venta"], h["SKU"],
                                     h["Semana"], h["Venta Fisica SelI In (TON)"], h["Año"])
    out = defaultdict(lambda: defaultdict(float))
    semanas = set()
    for r in filas:
        if r[ig] != "TRADICIONAL Y REGIONES" or r[ic] == "ALVI SUPERMERCADOS" or r[it] != "VENTA NORMAL":
            continue
        if not isinstance(r[isk], (int, float)) or not isinstance(r[iw], (int, float)):
            continue
        out[int(r[isk])][int(r[iw])] += num(r[isi])
        semanas.add((int(r[ia]), int(r[iw])))
    return {"CANAL TRADICIONAL": out}, sorted(semanas)


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


def construir(xlsx, anio, mes, promo=None, venta_real=None, precio_yoy=None):
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    fcst, semanas_fcst = leer_fcst(wb, mes)
    if promo:
        aplicar_promo_cenco(fcst, promo)
    hist = leer_precios(wb, anio)
    elast, elast_pool = elasticidades(hist, {f["sku"]: f["subcat"] for f in fcst})

    w_act = pesos_mes(anio, mes)
    w_ant = pesos_mes(anio - 1, mes)
    ult_fcst = max(semanas_fcst)
    proxy = [w for w in w_act if w not in semanas_fcst]

    sem_reales = sorted({w for d in hist.values() for w, v in d.items() if v["si1"] is not None})
    ult_real = max(sem_reales)
    sem_yoy = [w for w in sem_reales]
    sem_rr = [w for w in sem_reales if w > ult_real - SEMANAS_RUNRATE]
    dias_mes = calendar.monthrange(anio, mes)[1]
    sem_act = sum(w_act.values())   # semanas equivalentes del mes (lun–sáb)
    sem_ant = sum(w_ant.values())
    vr, vr_sem = venta_real if venta_real else ({}, [])

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
            "sop": 0.0, "fcst": 0.0, "fcst_ret": 0.0,
            "fcst_sem": defaultdict(float), "fcst_sem_ret": defaultdict(float),
            "cadenas": {}, "promos": [], "sop_ger": {}, "sop_vals": {}, "fcst_ger": defaultdict(float),
        })
        fm = fcst_mes(f["semanas"])
        s["fcst"] += fm
        s["fcst_ger"][f["gerencia"]] += fm
        s["sop_vals"].setdefault(f["gerencia"], []).append((round(f["sop"], 3), f["subcadena"]))
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
        if f["promo"] and not CLAVE_NO_PROMO.match(str(f["promo"])):
            s["promos"].append({
                "cadena": f["subcadena"], "nombre": str(f["promo"]),
                "duracion": f["promo_dur"].strftime("%d-%m-%Y") if isinstance(f["promo_dur"], dt.datetime) else (str(f["promo_dur"]) if f["promo_dur"] else ""),
                "vol": f["vol_pactado"] or None,
                "vigente": promo_vigente(f["promo"], f["promo_dur"], anio, mes),
            })

    # SOP por SKU = suma del SOP de cada gerencia (NACIONAL, ECUSA, JUNAEB…). Una gerencia que
    # repite exactamente el SOP de NACIONAL es un arrastre de la búsqueda y no se suma.
    sop_dup, sop_raro = [], []
    for s in skus.values():
        # dentro de una gerencia el SOP debe repetirse en todas las filas: se usa el valor más frecuente
        for ger, vals in s["sop_vals"].items():
            moda = max(set(v for v, _ in vals), key=lambda v: sum(1 for x, _ in vals if x == v))
            s["sop_ger"][ger] = moda
            for v, cad in vals:
                if v != moda:
                    sop_raro.append({"sku": s["sku"], "producto": s["producto"], "gerencia": ger, "cadena": cad, "valor": v, "usado": moda})
        nac = s["sop_ger"].get("NACIONAL")
        tot = 0.0
        for ger, v in s["sop_ger"].items():
            if ger != "NACIONAL" and nac is not None and abs(v - nac) < 0.01 and v > 0:
                sop_dup.append({"sku": s["sku"], "gerencia": ger, "sop": v, "fcst": s["fcst_ger"][ger]})
                s["sop_ger"][ger] = None
                continue
            tot += v
        s["sop"] = tot

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
        estac = (si_mes_ant / sem_ant) / rr_ant if rr_ant > 0 and si_mes_ant > 0 else None
        yoy_s, estac_s = yoy, estac
        if prior:
            if prior.get("yoy") and base_ant > 0:
                yoy_s = (base_act + K_YOY * prior["yoy"]) / (base_ant + K_YOY)
            if prior.get("estac") and rr_ant > 0 and si_mes_ant > 0:
                estac_s = (si_mes_ant / sem_ant + K_ESTAC * prior["estac"]) / (rr_ant + K_ESTAC)
        if estac_s:
            estac_s = min(max(estac_s, ESTAC_MIN), ESTAC_MAX)
        yoy_c = min(max(yoy_s, YOY_MIN), YOY_MAX) if yoy_s else None
        estac = estac_s
        metA = si_mes_ant * yoy_c if (yoy_c and si_mes_ant > 0) else None
        metB = rr_act * (estac if estac else 1.0) * sem_act if rr_act > 0 else None
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
            "rr": rr_act * sem_act, "estac": estac, "metA": metA, "metB": metB, "ref": ref,
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
            elif c["subcadena"] in vr and vr_sem:
                # base desde venta real 2026 (sin año anterior): ritmo semanal × semanas del mes
                semv = [w for _, w in vr_sem]
                real = vr[c["subcadena"]].get(s["sku"], {})
                tot_r = sum(real.get(w, 0) for w in semv)
                f_ov = sum(c["sem"].get(w, 0) for w in semv)
                row.update({"ref": tot_r / len(semv) * sem_act, "metB": tot_r / len(semv) * sem_act, "metA": None,
                            "rr": tot_r / len(semv) * sem_act, "fuente": "real",
                            "sesgo": f_ov / tot_r - 1 if tot_r > 0 else None, "ov_fcst": f_ov, "ov_real": tot_r})
            cads.append(row)
        m = metricas(h_sku) if h_sku else {}
        if h_sku:
            m.update(sesgo(s["fcst_sem_ret"], h_sku))
        prev = [w for w in semanas_fcst if w < min(w_act) and w >= min(w_act) - 4]
        prom_prev = sum(s["fcst_sem"].get(w, 0) for w in prev) / len(prev) if prev else 0
        prom_mes = s["fcst"] / sem_act
        salida.append({
            "sku": s["sku"], "producto": s["producto"], "subcat": s["subcat"],
            "fcst": s["fcst"], "sop": s["sop"], "fcst_ret": s["fcst_ret"],
            "ger": [{"gerencia": g_, "sop": s["sop_ger"][g_], "fcst": s["fcst_ger"][g_]} for g_ in s["sop_ger"]],
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
        "dias_mes": dias_mes, "sem_mes": sem_act, "sem_mes_ant": sem_ant,
        "venta_real_sem": [min(w for _, w in vr_sem), max(w for _, w in vr_sem)] if vr_sem else None,
        "venta_real_cad": sorted(vr),
        "sop_dup": sop_dup, "sop_raro": sop_raro,
        "elast": elast, "elast_pool": elast_pool, "elast_yoy": precio_yoy, "dp_max": DP_MAX,
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
    ap.add_argument("--venta-real", default=None, help="archivo TP de venta real (Sell In por semana) para Canal Tradicional")
    ap.add_argument("--anterior", default=None, help="versión anterior del FCST para comparar cambios por SKU")
    ap.add_argument("--precio-yoy", default=None, help="archivo TP mensual con el mismo mes de dos años (control de elasticidad)")
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
    venta_real = leer_venta_real(a.venta_real) if a.venta_real else None
    precio_yoy = elasticidad_yoy(a.precio_yoy) if a.precio_yoy else None
    datos = construir(a.xlsx, a.anio, a.mes, promo, venta_real, precio_yoy)
    if a.anterior:
        prev = construir(a.anterior, a.anio, a.mes)
        datos["anterior"] = {"archivo": prev["archivo"], "skus": {s["sku"]: {"fcst": s["fcst"], "sop": s["sop"]} for s in prev["skus"]}}
    datos = redondear(datos)
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
