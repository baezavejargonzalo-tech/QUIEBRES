import sys
import numpy as np
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import FormulaRule
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter as L

U = sys.argv[1]
OUT = sys.argv[2]
SNAP = sys.argv[3]
GRUPO = sys.argv[4] if len(sys.argv) > 4 else None  # ej. 'GRUPO LACTEOS Y JUGOS'
TAG = f' — {GRUPO.title()}' if GRUPO else ''
F_STOCK = U + '0bc6e28a-Stock_Pa_s_stock_2026-10-22.xlsx'
F_WMS = U + '950752a6-Informe_Stock_Pa_s_2026-10-22.xlsx'
F_FIL = U + '69fad528-Filtros_Mayo_2026_6_1.xlsx'
F_BASE = U + '9238154f-base_1.xlsx'

# ---------------- datos ----------------
base = pd.read_excel(F_BASE)
base['SKU'] = pd.to_numeric(base['SKU'], errors='coerce')
if GRUPO:
    base = base[base['Grupo Marketing'] == GRUPO]
base['Cat DMD'] = base['Cat DMD'].where(base['Cat DMD'].ne('-'), base['Categoria Producto'])
for c in ['FCST', 'Solicitado']:
    base[c] = base[c] * 1000  # ton -> kg
WEEKS = [202636, 202637, 202638, 202639, 202640, 202641, 202642]
STAT_WEEKS = WEEKS[:6]          # S36-S41 completas
DEV_WEEKS = [202638, 202639, 202640, 202641]  # últimas 4 completas

info = (base.sort_values('Semana').groupby('SKU')
        .agg(prod=('Nombre Producto', 'last'), cat=('Cat DMD', 'last'),
             alm=('Tipo de Almacenamiento', 'last'), foco=('Foco', 'last')))
sol = base.pivot_table(index='SKU', columns='Semana', values='Solicitado', aggfunc='sum').reindex(columns=WEEKS).fillna(0)
fc = base.pivot_table(index='SKU', columns='Semana', values='FCST', aggfunc='sum').reindex(columns=WEEKS).fillna(0)
dem = info.join(sol.add_prefix('S_')).join(fc.add_prefix('F_')).fillna(0)
dem['tot'] = dem[[f'S_{w}' for w in STAT_WEEKS]].sum(axis=1)
dem = dem.sort_values('tot', ascending=False)

cad = (base[base.Semana.isin(DEV_WEEKS)].groupby(['SKU', 'CADENA'])
       .agg(prod=('Nombre Producto', 'last'), sol=('Solicitado', 'sum'), fc=('FCST', 'sum')).reset_index())
cad = cad[(cad.sol > 0) | (cad.fc > 0)]
cad['abs'] = (cad.sol - cad.fc).abs()
cad = cad.sort_values('abs', ascending=False)
CADENAS = sorted(cad.CADENA.unique())

stock = pd.read_excel(F_STOCK)
stock['SKU'] = pd.to_numeric(stock['SKU'], errors='coerce')
stock = stock.dropna(subset=['SKU'])
if GRUPO:
    stock = stock[stock.SKU.isin(base.SKU)]

fil = pd.read_excel(F_FIL, header=None)
fil = fil.iloc[1:]
TOPE_COLS = {16: 'CENCOSUD CENTRAL', 20: 'JUMBO SALAS', 24: 'WALMART', 28: 'TOTTUS', 32: 'UNIMARC CENTRAL', 36: 'UNIMARC SALAS'}
ft = pd.DataFrame({'SKU': pd.to_numeric(fil[1], errors='coerce'), 'tipo': fil[3],
                   'vu': pd.to_numeric(fil[10], errors='coerce')})
for c, n in TOPE_COLS.items():
    v = pd.to_numeric(fil[c], errors='coerce')
    ft[n] = v.where(v > 0)
ft = ft.dropna(subset=['SKU']).drop_duplicates('SKU').set_index('SKU')
tn = list(TOPE_COLS.values())
ft['tope_min'] = ft[tn].min(axis=1)
ft['tope_max'] = ft[tn].max(axis=1)
ft['cad_exig'] = ft[tn].fillna(9).idxmin(axis=1).where(ft['tope_min'].notna())

wms = pd.read_excel(F_WMS)
wms['SKU'] = pd.to_numeric(wms['CODIGO_SAP'], errors='coerce')
wms = wms[wms.ESTADO.isin(['OK', 'XLIB'])].dropna(subset=['SKU', 'PORCENTAJE'])
wms = wms.join(ft[['tope_min', 'tope_max']], on='SKU')
wms['av'] = wms['PORCENTAJE'] / 100
wms['fuera'] = np.where(wms.av > wms.tope_min, wms.KILOS, 0)
wms['zona'] = np.where((wms.av <= wms.tope_min) & (wms.av > wms.tope_min - 0.06), wms.KILOS, 0)
wms['fuera_todas'] = np.where(wms.av > wms.tope_max, wms.KILOS, 0)
wms['avk'] = wms.av * wms.KILOS
g = wms.groupby('SKU')
lot = pd.DataFrame({'kg': g.KILOS.sum(), 'avk': g.avk.sum(), 'fuera': g.fuera.sum(),
                    'zona': g.zona.sum(), 'fuera_todas': g.fuera_todas.sum(), 'av_max': g.av.max()})
lot['av_pond'] = lot.avk / lot.kg.replace(0, np.nan)
xl = wms[(wms.ESTADO == 'XLIB') & wms.FECHA_LIBERACION.notna()].groupby('SKU').FECHA_LIBERACION.min()
lot = lot.join(xl.rename('prox_lib'))

st = stock.set_index('SKU').join(ft).join(lot, rsuffix='_l')
st = st.sort_values('Fcst sem (kg)', ascending=False)

# snapshot de VU para seguimiento histórico
snap = lot.join(ft[['tope_min', 'cad_exig']]).join(stock.set_index('SKU')[['Producto']], how='inner')
snap = snap.reset_index()
snap.insert(0, 'fecha_informe', '2026-10-22')
snap = snap[['fecha_informe', 'SKU', 'Producto', 'kg', 'av_pond', 'av_max', 'tope_min', 'cad_exig', 'fuera', 'zona', 'fuera_todas']]
snap.columns = ['fecha_informe', 'sku', 'producto', 'kg_disp_xlib', 'vu_avance_pond', 'vu_avance_max_lote',
                'tope_cadena_exigente', 'cadena_exigente', 'kg_fuera_filtro_exigente', 'kg_a_6pts_del_filtro', 'kg_fuera_todas_cadenas']
snap.round(4).to_csv(SNAP, index=False)

# ---------------- estilos ----------------
AR = 'Arial'
F_N = Font(name=AR, size=10)
F_B = Font(name=AR, size=10, bold=True)
F_H = Font(name=AR, size=10, bold=True, color='FFFFFF')
F_T = Font(name=AR, size=14, bold=True, color='C8001E')
F_ST = Font(name=AR, size=11, bold=True)
F_IN = Font(name=AR, size=10, color='0000FF')
F_LINK = Font(name=AR, size=10, color='008000')
FILL_H = PatternFill('solid', fgColor='C8001E')
FILL_H2 = PatternFill('solid', fgColor='444444')
FILL_IN = PatternFill('solid', fgColor='FFFF00')
FILL_SOFT = PatternFill('solid', fgColor='F2F2F2')
THIN = Side(style='thin', color='BFBFBF')
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical='top')
KG = '#,##0;-#,##0;-'
PCT = '0.0%;-0.0%;-'
DEC = '0.00'

wb = Workbook()


def header(ws, row, cols, fill=FILL_H):
    for i, h in enumerate(cols, 1):
        c = ws.cell(row, i, h)
        c.font = F_H
        c.fill = fill
        c.alignment = Alignment(wrap_text=True, vertical='center', horizontal='center')
        c.border = BOX
    ws.row_dimensions[row].height = 42


def widths(ws, ws_w):
    for i, w in enumerate(ws_w, 1):
        ws.column_dimensions[L(i)].width = w


def font_all(ws):
    for row in ws.iter_rows():
        for c in row:
            if c.font is None or c.font.name != AR:
                c.font = Font(name=AR, size=c.font.size if c.font else 10, bold=c.font.bold if c.font else False,
                              color=c.font.color if c.font else None)


def inp(c, v, fmt=None):
    c.value = v
    c.font = F_IN
    c.fill = FILL_IN
    c.border = BOX
    if fmt:
        c.number_format = fmt


# ---------------- Parámetros ----------------
P = wb.active
P.title = 'Parametros'
P['A1'] = 'Parámetros — edita solo las celdas amarillas (texto azul)'
P['A1'].font = F_T
rows = [
    ('Corte ABC: A hasta % acumulado', 0.80, PCT, 'Pareto estándar: los SKU que suman el 80% del volumen son A.'),
    ('Corte ABC: B hasta % acumulado', 0.95, PCT, 'Del 80% al 95% son B; el resto (5% del volumen) son C.'),
    ('Corte XYZ: X si CV ≤', 0.50, DEC, 'CV = desviación estándar / promedio semanal. Corte usual en demanda semanal por SKU.'),
    ('Corte XYZ: Y si CV ≤', 1.00, DEC, 'Sobre este valor el SKU es Z (errático).'),
    ('Nivel de servicio A', 0.98, PCT, 'Supuesto inicial (benchmark internacional). Ajustar según política Watt\'s.'),
    ('Nivel de servicio B', 0.95, PCT, 'Supuesto inicial.'),
    ('Nivel de servicio C', 0.90, PCT, 'Supuesto inicial.'),
    ('Nivel de servicio SKU sin historial', 0.95, PCT, 'Para SKU sin ventas en la base S36-S41.'),
    ('Lead time por defecto (semanas)', 1.0, DEC, 'SUPUESTO: no se recibió lead time real. Reemplazar por categoría en la tabla de abajo.'),
    ('σ por defecto (% del FCST semanal) si no hay historial', 0.30, PCT, 'SUPUESTO para SKU sin historial de pedidos.'),
    ('Umbral desviación pedido vs FCST (±)', 0.20, PCT, 'Alerta si |Solicitado/FCST − 1| supera este valor.'),
    ('Volumen mínimo para alertar desviación SKU (kg, 4 sem)', 2000, KG, 'Evita alertas por SKU de volumen marginal.'),
    ('Volumen mínimo para alertar desviación SKU×cadena (kg, 4 sem)', 1000, KG, 'Idem, a nivel SKU×cadena.'),
    ('Kg mínimo para alertar VU (por SKU)', 500, KG, 'Evita alertas por saldos pequeños de lotes.'),
    ('Margen de alerta VU (puntos de avance antes del filtro)', 0.06, PCT, 'Misma regla del dashboard: alerta si el lote está a ≤ 6 pts del tope de la cadena más exigente.'),
]
header(P, 3, ['Parámetro', 'Valor', 'Nota / fuente'])
PR = {}
for i, (n, v, fmt, note) in enumerate(rows, 4):
    P.cell(i, 1, n).font = F_N
    inp(P.cell(i, 2), v, fmt)
    P.cell(i, 3, note).font = F_N
    PR[n] = f'Parametros!$B${i}'
pA, pB = PR['Corte ABC: A hasta % acumulado'], PR['Corte ABC: B hasta % acumulado']
cX, cY = PR['Corte XYZ: X si CV ≤'], PR['Corte XYZ: Y si CV ≤']
nsA, nsB, nsC, nsN = (PR['Nivel de servicio A'], PR['Nivel de servicio B'], PR['Nivel de servicio C'],
                      PR['Nivel de servicio SKU sin historial'])
LTdef = PR['Lead time por defecto (semanas)']
SIGdef = PR['σ por defecto (% del FCST semanal) si no hay historial']
DEVp = PR['Umbral desviación pedido vs FCST (±)']
DEVmin = PR['Volumen mínimo para alertar desviación SKU (kg, 4 sem)']
DEVminC = PR['Volumen mínimo para alertar desviación SKU×cadena (kg, 4 sem)']
VUm = PR['Margen de alerta VU (puntos de avance antes del filtro)']
VUkg = PR['Kg mínimo para alertar VU (por SKU)']

r0 = 4 + len(rows) + 2
P.cell(r0, 1, 'Matriz ABC/XYZ — qué hacer con cada segmento').font = F_ST
header(P, r0 + 1, ['Segmento', 'Cómo planificarlo', 'Frecuencia de revisión'], FILL_H2)
MATRIX = [
    ('AX', 'Forecast estadístico casi automático. Ajustes mínimos. SS bajo porque la demanda es estable.', 'Mensual'),
    ('AY', 'Alto volumen con variaciones: entender causas (promos, cadenas). Validar con KAM antes de ajustar.', 'Semanal'),
    ('AZ', 'FOCO MÁXIMO. Mucho volumen y errático: CPFR con cadenas, separar promociones de la base, SS alto.', '2 veces por semana'),
    ('BX', 'Estadístico + revisión de tendencia.', 'Mensual'),
    ('BY', 'Validar promociones y eventos con comercial.', 'Quincenal'),
    ('BZ', 'Investigar causa de la variabilidad; evaluar producir contra pedido confirmado.', 'Semanal'),
    ('CX', 'Reposición simple mín/máx.', 'Trimestral'),
    ('CY', 'Mín/máx con stock bajo; evaluar continuidad del SKU.', 'Mensual'),
    ('CZ', 'Contra pedido o stock mínimo. Candidato a racionalizar/descontinuar.', 'Mensual'),
]
m0 = r0 + 2
for i, (s, a, fq) in enumerate(MATRIX):
    for j, v in enumerate((s, a, fq), 1):
        c = P.cell(m0 + i, j, v)
        c.font = F_B if j == 1 else F_N
        c.alignment = WRAP
        c.border = BOX
MAT_SEG = f'Parametros!$A${m0}:$A${m0 + 8}'
MAT_ACC = f'Parametros!$B${m0}:$B${m0 + 8}'
MAT_FRQ = f'Parametros!$C${m0}:$C${m0 + 8}'

l0 = m0 + 11
P.cell(l0, 1, 'Lead time de reposición por categoría (semanas) — reemplaza con el dato real').font = F_ST
header(P, l0 + 1, ['Categoría', 'Lead time (sem)', 'Nota'], FILL_H2)
cats = sorted(stock['Categoría'].dropna().unique())
for i, ccat in enumerate(cats):
    P.cell(l0 + 2 + i, 1, ccat).font = F_N
    inp(P.cell(l0 + 2 + i, 2), f'={LTdef}', DEC)
    P.cell(l0 + 2 + i, 3, 'Usa el valor por defecto hasta que ingreses el real').font = F_N
LT_RNG = f'Parametros!$A${l0 + 2}:$B${l0 + 1 + len(cats)}'
widths(P, [52, 18, 95])

# ---------------- Datos_Semanales ----------------
D = wb.create_sheet('Datos_Semanales')
D['A1'] = 'Pedidos (Solicitado) y FCST semanales por SKU, en kg — fuente: base_1.xlsx (todas las cadenas sumadas)' + TAG
D['A1'].font = F_ST
D['A2'] = 'S42 parece cargada incompleta (Solicitado −35% vs S41 en todas las cadenas): no se usa en los cálculos. S38 incluye Fiestas Patrias.'
D['A2'].font = Font(name=AR, size=10, italic=True, color='C00000')
dcols = ['SKU', 'Producto', 'Categoría', 'Almacenamiento', 'Foco'] + \
    [f'Sol S{str(w)[-2:]}' for w in WEEKS] + [f'FCST S{str(w)[-2:]}' for w in WEEKS]
header(D, 4, dcols)
for i, (sku, r) in enumerate(dem.iterrows(), 5):
    vals = [int(sku), r['prod'], r['cat'], r['alm'], r['foco']] + \
        [r[f'S_{w}'] for w in WEEKS] + [r[f'F_{w}'] for w in WEEKS]
    for j, v in enumerate(vals, 1):
        c = D.cell(i, j, v)
        c.font = F_N
        if j > 5:
            c.number_format = KG
DN = 4 + len(dem)
D.freeze_panes = 'C5'
D.auto_filter.ref = f'A4:{L(len(dcols))}{DN}'
widths(D, [11, 42, 22, 13, 10] + [10] * 14)

# ---------------- ABC_XYZ ----------------
A = wb.create_sheet('ABC_XYZ')
A['A1'] = 'Segmentación ABC (volumen) / XYZ (variabilidad) — pedidos S36 a S41' + TAG
A['A1'].font = F_T
A['A2'] = 'Todo se calcula con fórmulas desde Datos_Semanales y Parametros. Filtra la columna Segmento para ver tu lista de foco (AY, AZ, BZ).'
A['A2'].font = F_N
acols = ['SKU', 'Producto', 'Categoría', 'Total pedido 6 sem (kg)', 'Promedio sem (kg)', 'Desv. estándar (kg)',
         'CV', '% del volumen', '% acumulado', 'ABC', 'XYZ', 'Segmento', 'Cómo planificarlo', 'Revisión',
         'FCST 6 sem (kg)', 'WMAPE forecast', 'Sesgo (Bias)', 'Error forecast RMSE (kg/sem)']
header(A, 4, acols)
first, last = 5, DN
for i in range(first, last + 1):
    sol_rng = f'Datos_Semanales!F{i}:K{i}'
    fc_rng = f'Datos_Semanales!M{i}:R{i}'
    f = {
        1: f'=Datos_Semanales!A{i}', 2: f'=Datos_Semanales!B{i}', 3: f'=Datos_Semanales!C{i}',
        4: f'=SUM({sol_rng})', 5: f'=AVERAGE({sol_rng})', 6: f'=STDEV({sol_rng})',
        7: f'=IF(E{i}>0,F{i}/E{i},"")',
        8: f'=IF(SUM($D${first}:$D${last})>0,D{i}/SUM($D${first}:$D${last}),0)',
        9: f'=SUMIF($D${first}:$D${last},">="&D{i})/SUM($D${first}:$D${last})',
        10: f'=IF(D{i}<=0,"C",IF(I{i}<={pA},"A",IF(I{i}<={pB},"B","C")))',
        11: f'=IF(E{i}<=0,"Z",IF(G{i}<={cX},"X",IF(G{i}<={cY},"Y","Z")))',
        12: f'=J{i}&K{i}',
        13: f'=INDEX({MAT_ACC},MATCH(L{i},{MAT_SEG},0))',
        14: f'=INDEX({MAT_FRQ},MATCH(L{i},{MAT_SEG},0))',
        15: f'=SUM({fc_rng})',
        16: f'=IF(D{i}>0,SUMPRODUCT(ABS({sol_rng}-{fc_rng}))/D{i},"")',
        17: f'=IF(D{i}>0,O{i}/D{i}-1,"")',
        18: f'=SQRT(SUMXMY2({sol_rng},{fc_rng})/COUNT({sol_rng}))',
    }
    fmts = {4: KG, 5: KG, 6: KG, 7: DEC, 8: PCT, 9: PCT, 15: KG, 16: PCT, 17: PCT, 18: KG}
    for j, v in f.items():
        c = A.cell(i, j, v)
        c.font = F_LINK if j <= 3 else F_N
        if j in fmts:
            c.number_format = fmts[j]
A.cell(4, 17).comment = Comment('Sesgo = FCST / pedido − 1. Positivo: sobreestimas (riesgo merma). Negativo: subestimas (riesgo quiebre).', 'Claude')
A.cell(4, 16).comment = Comment('WMAPE = suma |pedido − FCST| / suma pedido. Bajo 20% es bueno a nivel SKU semanal.', 'Claude')
A.freeze_panes = 'C5'
A.auto_filter.ref = f'A4:{L(len(acols))}{last}'
widths(A, [11, 40, 20, 13, 12, 12, 7, 10, 10, 6, 6, 9, 60, 14, 13, 11, 11, 13])
# resumen 3x3
rc = len(acols) + 2
A.cell(4, rc, 'Resumen').font = F_B
A.cell(5, rc, 'N° SKU').font = F_B
A.cell(10, rc, '% del volumen').font = F_B
for k, x in enumerate('XYZ'):
    A.cell(5, rc + 1 + k, x).font = F_B
    A.cell(10, rc + 1 + k, x).font = F_B
for k, a in enumerate('ABC'):
    A.cell(6 + k, rc, a).font = F_B
    A.cell(11 + k, rc, a).font = F_B
    for q, x in enumerate('XYZ'):
        A.cell(6 + k, rc + 1 + q, f'=COUNTIF($L${first}:$L${last},"{a}{x}")').font = F_N
        c = A.cell(11 + k, rc + 1 + q, f'=SUMIF($L${first}:$L${last},"{a}{x}",$D${first}:$D${last})/SUM($D${first}:$D${last})')
        c.font = F_N
        c.number_format = PCT
for col in range(rc, rc + 4):
    A.column_dimensions[L(col)].width = 13
for rr in (5, 10):
    A.cell(rr + 1, rc + 4, 'Total').font = F_B
A.cell(14, rc, 'Interpretación: la fila A concentra el 80% del volumen. La columna Z son los SKU erráticos. AZ + AY + BZ = tu lista de foco.').font = Font(name=AR, size=9, italic=True)

# ---------------- Stock_Seguridad ----------------
S = wb.create_sheet('Stock_Seguridad')
S['A1'] = 'Stock de seguridad calculado — SS = Z × σ × √(Lead time), con techo por vida útil' + TAG
S['A1'].font = F_T
S['A2'] = ('σ = error del forecast (RMSE semanal Solicitado vs FCST): es lo que el SS debe cubrir. Techo VU: el stock objetivo '
           'no puede superar lo que se vende antes de llegar al filtro de la cadena más exigente.')
S['A2'].font = F_N
scols = ['SKU', 'Producto', 'Categoría', 'Planta', 'Tipo', 'Segmento', 'Nivel de servicio', 'Z',
         'FCST sem (kg)', 'σ error (kg/sem)', 'Lead time (sem)', 'SS teórico (kg)',
         'VU interna (días)', 'Tope avance cadena exigente', 'Cadena exigente', 'Semanas vendibles',
         'Stock máx. vendible (kg)', 'SS final (kg)', 'Punto de reorden (kg)',
         'Stock disp (kg)', 'XLIB (kg)', 'Disp+XLIB (kg)', 'Cobertura (sem)', 'Estado']
header(S, 4, scols)
S1 = 5
SN = S1 + len(st) - 1
ABC_SKU = f'ABC_XYZ!$A${first}:$A${last}'
for i, (sku, r) in enumerate(st.iterrows(), S1):
    tipo = r['tipo'] if isinstance(r['tipo'], str) and r['tipo'].strip() else ''
    data = {1: int(sku), 2: r['Producto'], 3: r['Categoría'] if isinstance(r['Categoría'], str) else '',
            4: r['Planta Genérica'] if isinstance(r['Planta Genérica'], str) else '', 5: tipo,
            9: float(r['Fcst sem (kg)']),
            13: (float(r['vu']) if pd.notna(r['vu']) else None),
            14: (float(r['tope_min']) if pd.notna(r['tope_min']) else None),
            15: (r['cad_exig'] if isinstance(r['cad_exig'], str) else None),
            20: float(r['Stock disp (kg)']), 21: float(r['XLIB (kg)'])}
    form = {
        6: f'=IFERROR(INDEX(ABC_XYZ!$L${first}:$L${last},MATCH(A{i},{ABC_SKU},0)),"SIN HIST")',
        7: f'=IF(LEFT(F{i},1)="A",{nsA},IF(LEFT(F{i},1)="B",{nsB},IF(LEFT(F{i},1)="C",{nsC},{nsN})))',
        8: f'=NORMSINV(G{i})',
        10: f'=IFERROR(INDEX(ABC_XYZ!$R${first}:$R${last},MATCH(A{i},{ABC_SKU},0)),I{i}*{SIGdef})',
        11: f'=IFERROR(VLOOKUP(C{i},{LT_RNG},2,FALSE),{LTdef})',
        12: f'=H{i}*J{i}*SQRT(K{i})',
        16: f'=IF(AND(ISNUMBER(M{i}),ISNUMBER(N{i})),M{i}*N{i}/7,"")',
        17: f'=IF(ISNUMBER(P{i}),I{i}*P{i},"")',
        18: f'=IF(ISNUMBER(Q{i}),MAX(0,MIN(L{i},Q{i}-I{i}*K{i})),L{i})',
        19: f'=R{i}+I{i}*K{i}',
        22: f'=T{i}+U{i}',
        23: f'=IF(I{i}>0,V{i}/I{i},"")',
        24: (f'=IF(I{i}<=0,"SIN FCST",IF(V{i}<R{i},"BAJO SS",IF(T{i}<R{i},"BAJO SS (XLIB CUBRE)",IF(V{i}<S{i},"BAJO P.REORDEN",'
             f'IF(AND(ISNUMBER(Q{i}),V{i}>Q{i}),"SOBRE MAX VENDIBLE","OK")))))'),
    }
    fmts = {7: PCT, 8: DEC, 9: KG, 10: KG, 11: DEC, 12: KG, 13: '0', 14: PCT, 16: '0.0', 17: KG, 18: KG,
            19: KG, 20: KG, 21: KG, 22: KG, 23: '0.0'}
    for j, v in {**data, **form}.items():
        c = S.cell(i, j, v)
        c.font = F_N
        if j in fmts:
            c.number_format = fmts[j]
S.freeze_panes = 'C5'
S.auto_filter.ref = f'A4:{L(len(scols))}{SN}'
widths(S, [11, 40, 20, 13, 12, 9, 9, 6, 11, 11, 9, 11, 9, 10, 15, 9, 12, 11, 12, 12, 11, 12, 9, 19])

# ---------------- Cadenas ----------------
C = wb.create_sheet('Cadenas_vs_FCST')
C['A1'] = 'Pedidos por cadena vs FCST — últimas 4 semanas completas (S38 a S41)' + TAG
C['A1'].font = F_T
C['A2'] = 'Resumen por cadena arriba; detalle SKU × cadena abajo (filtra la columna Alerta).'
C['A2'].font = F_N
header(C, 4, ['Cadena', 'Solicitado (kg)', 'FCST (kg)', 'Desviación (kg)', 'Desviación %',
              'Ranking volumen pedido', 'Ranking desviación |%|', 'N° SKU con alerta'])
c_first = 4 + len(CADENAS) + 4
c_last = c_first + len(cad) - 1
DR = lambda col: f'${col}${c_first}:${col}${c_last}'
for k, name in enumerate(CADENAS):
    i = 5 + k
    rng = f'$A$5:$A${4 + len(CADENAS)}'
    vals = {1: name,
            2: f'=SUMIFS({DR("D")},{DR("C")},A{i})',
            3: f'=SUMIFS({DR("E")},{DR("C")},A{i})',
            4: f'=B{i}-C{i}',
            5: f'=IF(C{i}>0,B{i}/C{i}-1,"")',
            6: f'=RANK(B{i},$B$5:$B${4 + len(CADENAS)})',
            7: f'=SUMPRODUCT(--(ABS($E$5:$E${4 + len(CADENAS)})>ABS(E{i})))+1',
            8: (f'=COUNTIFS({DR("C")},A{i},{DR("H")},"SOBRE FCST")+COUNTIFS({DR("C")},A{i},{DR("H")},"BAJO FCST")'
                f'+COUNTIFS({DR("C")},A{i},{DR("H")},"PIDE SIN FCST")')}
    for j, v in vals.items():
        c = C.cell(i, j, v)
        c.font = F_B if j == 1 else F_N
        c.number_format = {2: KG, 3: KG, 4: KG, 5: PCT}.get(j, 'General')
tr = 5 + len(CADENAS)
C.cell(tr, 1, 'TOTAL').font = F_B
for j, col in ((2, 'B'), (3, 'C'), (4, 'D')):
    c = C.cell(tr, j, f'=SUM({col}5:{col}{tr - 1})')
    c.font = F_B
    c.number_format = KG
c = C.cell(tr, 5, f'=IF(C{tr}>0,B{tr}/C{tr}-1,"")')
c.font = F_B
c.number_format = PCT
header(C, c_first - 1, ['SKU', 'Producto', 'Cadena', 'Solicitado 4 sem (kg)', 'FCST 4 sem (kg)',
                        'Desviación (kg)', 'Desviación %', 'Alerta'])
for i, r in enumerate(cad.itertuples(), c_first):
    vals = {1: int(r.SKU), 2: r.prod, 3: r.CADENA, 4: float(r.sol), 5: float(r.fc),
            6: f'=D{i}-E{i}', 7: f'=IF(E{i}>0,D{i}/E{i}-1,"")',
            8: (f'=IF(MAX(D{i},E{i})<{DEVminC},"",IF(E{i}=0,"PIDE SIN FCST",IF(ABS(G{i})>{DEVp},'
                f'IF(G{i}>0,"SOBRE FCST","BAJO FCST"),"")))')}
    for j, v in vals.items():
        c = C.cell(i, j, v)
        c.font = F_N
        c.number_format = {4: KG, 5: KG, 6: KG, 7: PCT}.get(j, 'General')
C.auto_filter.ref = f'A{c_first - 1}:H{c_last}'
C.freeze_panes = f'A{c_first}'
widths(C, [24, 42, 24, 14, 14, 14, 12, 16])

# ---------------- Excepciones ----------------
E = wb.create_sheet('Excepciones', 1)
E['A1'] = 'Tablero de excepciones — revisa solo lo que tiene alerta' + TAG
E['A1'].font = F_T
E['A2'] = 'Ordena por Puntaje (mayor a menor) y trabaja de arriba hacia abajo. Puntaje = (Quiebre×3 + Encubierto×2 + Merma/VU×2 + Desviación×1) × peso ABC (A=3, B=2, C=1). Cada fila dice qué revisar. Datos al 22-10-2026.'
E['A2'].font = F_N
ecols = ['SKU', 'Producto', 'Categoría', 'Segmento', 'Estado stock', 'Cobertura (sem)',
         'Stock disp (kg)', 'SS final (kg)', 'Punto reorden (kg)', 'XLIB (kg)', 'Próx. liberación',
         'Kg fuera filtro cadena exigente', 'Kg a ≤6 pts del filtro', 'Kg fuera de TODAS las cadenas',
         'Avance VU ponderado', 'Tope cadena exigente', 'Margen (pts)', 'Stock útil cadena exigente (kg)',
         'Solicitado 4 sem (kg)', 'FCST 4 sem (kg)', 'Desv. %',
         'ALERTA QUIEBRE', 'QUIEBRE ENCUBIERTO (VU)', 'ALERTA MERMA/VU', 'ALERTA DESVIACIÓN',
         'N° alertas', 'Puntaje', 'Prioridad', 'Qué revisar']
header(E, 4, ecols)
for k, (sku, r) in enumerate(st.iterrows()):
    i = S1 + k
    s = i  # misma fila en Stock_Seguridad
    data = {11: (r['prox_lib'].to_pydatetime() if pd.notna(r['prox_lib']) else None),
            12: (float(r['fuera']) if pd.notna(r['fuera']) else None),
            13: (float(r['zona']) if pd.notna(r['zona']) else None),
            14: (float(r['fuera_todas']) if pd.notna(r['fuera_todas']) else None),
            15: (float(r['av_pond']) if pd.notna(r['av_pond']) else None)}
    form = {
        1: f'=Stock_Seguridad!A{s}', 2: f'=Stock_Seguridad!B{s}', 3: f'=Stock_Seguridad!C{s}',
        4: f'=Stock_Seguridad!F{s}', 5: f'=Stock_Seguridad!X{s}', 6: f'=Stock_Seguridad!W{s}',
        7: f'=Stock_Seguridad!T{s}', 8: f'=Stock_Seguridad!R{s}', 9: f'=Stock_Seguridad!S{s}',
        10: f'=Stock_Seguridad!U{s}',
        16: f'=IF(ISNUMBER(Stock_Seguridad!N{s}),Stock_Seguridad!N{s},"")',
        17: f'=IF(AND(ISNUMBER(O{i}),ISNUMBER(P{i})),P{i}-O{i},"")',
        18: f'=MAX(0,G{i}-N(L{i}))',
        19: f'=SUMIFS(Cadenas_vs_FCST!{DR("D")},Cadenas_vs_FCST!{DR("A")},A{i})',
        20: f'=SUMIFS(Cadenas_vs_FCST!{DR("E")},Cadenas_vs_FCST!{DR("A")},A{i})',
        21: f'=IF(T{i}>0,S{i}/T{i}-1,"")',
        22: f'=IF(OR(E{i}="BAJO SS",E{i}="BAJO SS (XLIB CUBRE)"),"SÍ","")',
        23: f'=IF(AND(V{i}="",N(L{i})>={VUkg},G{i}>=H{i},R{i}<H{i}),"SÍ","")',
        24: f'=IF(OR(E{i}="SOBRE MAX VENDIBLE",N(N{i})>={VUkg},N(M{i})>={VUkg}),"SÍ","")',
        25: f'=IF(AND(ISNUMBER(U{i}),MAX(S{i},T{i})>={DEVmin},ABS(N(U{i}))>{DEVp}),"SÍ","")',
        26: f'=COUNTIF(V{i}:Y{i},"SÍ")',
        27: (f'=(3*(V{i}="SÍ")+2*(W{i}="SÍ")+2*(X{i}="SÍ")+(Y{i}="SÍ"))'
             f'*IF(LEFT(D{i},1)="A",3,IF(OR(LEFT(D{i},1)="B",D{i}="SIN HIST"),2,1))'),
        28: f'=IF(AA{i}>=9,"1-ALTA",IF(AA{i}>=4,"2-MEDIA",IF(AA{i}>0,"3-BAJA","")))',
        29: (f'=IF(E{i}="BAJO SS","Stock + XLIB bajo el SS: riesgo real de quiebre, adelantar producción. ","")'
             f'&IF(E{i}="BAJO SS (XLIB CUBRE)","Disponible bajo el SS; depende de liberar "&TEXT(J{i},"#,##0")&" kg"&IF(ISNUMBER(K{i})," el "&TEXT(K{i},"dd-mm"),"")&". ","")'
             f'&IF(W{i}="SÍ","Stock parece sano pero "&TEXT(L{i},"#,##0")&" kg no pasan filtro "&Stock_Seguridad!O{s}&": sin ellos queda bajo el SS para esa cadena. ","")'
             f'&IF(E{i}="SOBRE MAX VENDIBLE","Sobrestock vs vida útil: frenar producción/activar venta. ","")'
             f'&IF(N(N{i})>={VUkg},TEXT(N{i},"#,##0")&" kg ya no los acepta ninguna cadena: venta intermedia/liquidación. ","")'
             f'&IF(N(M{i})>={VUkg},TEXT(M{i},"#,##0")&" kg a punto de salir del filtro: despachar primero (FEFO). ","")'
             f'&IF(Y{i}="SÍ","Pedidos "&IF(N(U{i})>0,"sobre","bajo")&" FCST "&TEXT(ABS(N(U{i})),"0%")&": revisar forecast con KAM.","")'),
    }
    fmts = {6: '0.0', 7: KG, 8: KG, 9: KG, 10: KG, 11: 'dd-mm-yyyy', 12: KG, 13: KG, 14: KG, 15: PCT, 16: PCT,
            17: PCT, 18: KG, 19: KG, 20: KG, 21: PCT}
    for j, v in {**data, **form}.items():
        c = E.cell(i, j, v)
        c.font = F_LINK if j <= 10 else F_N
        if j in fmts:
            c.number_format = fmts[j]
EN = S1 + len(st) - 1
E.freeze_panes = 'C5'
E.auto_filter.ref = f'A4:{L(len(ecols))}{EN}'
widths(E, [11, 38, 18, 9, 20, 9, 12, 11, 11, 10, 11, 12, 11, 12, 9, 9, 8, 12, 12, 12, 9, 9, 11, 10, 11, 8, 8, 9, 95])
red = PatternFill('solid', fgColor='F8CBAD')
org = PatternFill('solid', fgColor='FCE4D6')
pur = PatternFill('solid', fgColor='E4DFEC')
grn = PatternFill('solid', fgColor='E2EFDA')
for ws, col, n1, n2 in ((E, 'E', S1, EN), (S, 'X', S1, SN)):
    rng = f'{col}{n1}:{col}{n2}'
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{col}{n1}="BAJO SS"'], fill=red))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{col}{n1}="BAJO SS (XLIB CUBRE)"'], fill=org))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{col}{n1}="BAJO P.REORDEN"'], fill=PatternFill('solid', fgColor='FFF2CC')))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{col}{n1}="SOBRE MAX VENDIBLE"'], fill=pur))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{col}{n1}="OK"'], fill=grn))
E.conditional_formatting.add(f'V{S1}:Y{EN}', FormulaRule(formula=[f'V{S1}="SÍ"'], fill=red, font=Font(name=AR, bold=True, color='9C0006')))
E.conditional_formatting.add(f'AB{S1}:AB{EN}', FormulaRule(formula=[f'AB{S1}="1-ALTA"'], fill=red))
C.conditional_formatting.add(f'H{c_first}:H{c_last}', FormulaRule(formula=[f'H{c_first}<>""'], fill=org))

# resumen en Excepciones (columna AD en adelante)
rcol = len(ecols) + 2
E.cell(4, rcol, 'Resumen').font = F_B
summ = [('SKU con alerta de quiebre', f'=COUNTIF(V{S1}:V{EN},"SÍ")'),
        ('SKU con quiebre encubierto (VU)', f'=COUNTIF(W{S1}:W{EN},"SÍ")'),
        ('SKU con alerta merma/VU', f'=COUNTIF(X{S1}:X{EN},"SÍ")'),
        ('SKU con desviación pedido vs FCST', f'=COUNTIF(Y{S1}:Y{EN},"SÍ")'),
        ('Prioridad 1-ALTA', f'=COUNTIF(AB{S1}:AB{EN},"1-ALTA")'),
        ('Prioridad 2-MEDIA', f'=COUNTIF(AB{S1}:AB{EN},"2-MEDIA")'),
        ('Kg fuera de filtro cadena exigente', f'=SUM(L{S1}:L{EN})'),
        ('Kg fuera de TODAS las cadenas', f'=SUM(N{S1}:N{EN})')]
for k, (n, fml) in enumerate(summ):
    E.cell(5 + k, rcol, n).font = F_N
    c = E.cell(5 + k, rcol + 1, fml)
    c.font = F_B
    c.number_format = KG
E.column_dimensions[L(rcol)].width = 34
E.column_dimensions[L(rcol + 1)].width = 12

# ---------------- Cómo usar ----------------
G = wb.create_sheet('Como_usar', 0)
G.column_dimensions['A'].width = 4
for col, w in zip('BCDEFGHIJ', [30, 12, 12, 12, 12, 12, 12, 14, 40]):
    G.column_dimensions[col].width = w
r = 1
G.cell(r, 2, 'Herramienta Demand Planner — Watt\'s' + TAG + ' (datos al 22-10-2026)').font = F_T
r += 2
intro = [
    'Hojas de este libro:',
    '• Excepciones — tu tablero diario. Una fila por SKU; solo mira las que tienen alerta. Columna "Qué revisar" te dice la acción.',
    '• Stock_Seguridad — cálculo de SS, punto de reorden y techo por vida útil para cada SKU.',
    '• ABC_XYZ — segmentación de cada SKU y cómo planificarlo. Incluye calidad del forecast (WMAPE y sesgo).',
    '• Cadenas_vs_FCST — qué cadena pidió más y cuál se desvió más del forecast (S38-S41).',
    '• Parametros — celdas amarillas editables: cortes, niveles de servicio, lead time, umbrales.',
    '• Datos_Semanales — pedidos y FCST por SKU (fuente). Para actualizar: pega las semanas nuevas aquí.',
    'Convención de colores: texto azul en celda amarilla = dato que tú editas. Texto negro = fórmula. Texto verde = viene de otra hoja.',
]
for t in intro:
    G.cell(r, 2, t).font = F_B if t.endswith(':') else F_N
    r += 1

r += 1
G.cell(r, 2, '1. ¿Qué es ABC/XYZ? — Ejemplo con fórmulas (cambia los números azules y mira cómo cambia)').font = F_ST
r += 1
G.cell(r, 2, 'ABC mide CUÁNTO vende el SKU (importancia). XYZ mide QUÉ TAN ESTABLE es (predictibilidad). Se cruzan en 9 segmentos.').font = F_N
r += 2
hdr = ['SKU ejemplo', 'Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Promedio', 'Desv. est.', 'CV', 'XYZ']
ex = [('Leche entera 1L (estable)', [10000, 10400, 9800, 10200, 9900, 10100]),
      ('Yogurt con promo (variable)', [1500, 5200, 1000, 4800, 900, 3500]),
      ('Queso especial (errático)', [200, 1500, 0, 900, 50, 1800])]
for j, h in enumerate(hdr, 2):
    c = G.cell(r, j, h)
    c.font = F_H
    c.fill = FILL_H2
for col, w in zip('KL', [10, 8]):
    G.column_dimensions[col].width = w
r += 1
for name, v in ex:
    G.cell(r, 2, name).font = F_N
    for k, x in enumerate(v):
        inp(G.cell(r, 3 + k), x, KG)
    G.cell(r, 9, f'=AVERAGE(C{r}:H{r})').number_format = KG
    G.cell(r, 10, f'=STDEV(C{r}:H{r})').number_format = KG
    G.cell(r, 11, f'=J{r}/I{r}').number_format = DEC
    G.cell(r, 12, f'=IF(K{r}<={cX},"X",IF(K{r}<={cY},"Y","Z"))')
    r += 1
notes = [
    'CV (coeficiente de variación) = desviación estándar ÷ promedio. CV 0,02 = la leche vende casi igual todas las semanas → X.',
    'CV ≤ 0,5 → X (estable, se planifica con estadística).  0,5–1,0 → Y (variable, hay que entender por qué).  > 1,0 → Z (errático).',
    'ABC: ordenas los SKU de mayor a menor volumen y sumas. Los que llegan al 80% del total son A; hasta el 95% son B; el resto C.',
    'Ejemplo: si un SKU es A (mucho volumen) y Z (errático) = AZ → es donde un error te cuesta más: ahí va tu tiempo.',
    'Un AX (mucho volumen, estable) casi se planifica solo: no lo toques cada semana. Un CZ (poco y errático) no merece tu tiempo: stock mínimo.',
    'Tu lista real está en la hoja ABC_XYZ; la matriz de acciones por segmento está en Parametros.',
]
r += 1
for t in notes:
    G.cell(r, 2, t).font = F_N
    r += 1

r += 1
G.cell(r, 2, '2. Stock de seguridad — Ejemplo con fórmulas').font = F_ST
r += 1
G.cell(r, 2, 'El SS cubre el ERROR del forecast durante el tiempo que tardas en reponer. Por eso usa σ del error (no de la venta).').font = F_N
r += 2
ss_rows = [('FCST semanal (kg)', 10000, KG, True), ('σ del error del forecast (kg/sem)', 2000, KG, True),
           ('Lead time (semanas)', 2, DEC, True), ('Nivel de servicio', 0.98, PCT, True),
           ('Z (=NORMSINV(nivel))', None, DEC, False), ('SS = Z × σ × √LT (kg)', None, KG, False),
           ('Punto de reorden = SS + FCST × LT (kg)', None, KG, False), ('VU del producto (días)', 50, '0', True),
           ('Tope avance cadena más exigente', 0.35, PCT, True), ('Semanas vendibles = VU × tope / 7', None, '0.0', False),
           ('Stock máx. vendible = FCST × semanas vendibles', None, KG, False),
           ('SS final = MIN(SS, máx. vendible − FCST × LT)', None, KG, False)]
r_ss = r
for k, (n, v, fmt, is_in) in enumerate(ss_rows):
    G.cell(r + k, 2, n).font = F_N
    c = G.cell(r + k, 4)
    if is_in:
        inp(c, v, fmt)
    else:
        c.number_format = fmt
G.cell(r_ss + 4, 4, f'=NORMSINV(D{r_ss + 3})')
G.cell(r_ss + 5, 4, f'=D{r_ss + 4}*D{r_ss + 1}*SQRT(D{r_ss + 2})')
G.cell(r_ss + 6, 4, f'=D{r_ss + 5}+D{r_ss}*D{r_ss + 2}')
G.cell(r_ss + 9, 4, f'=D{r_ss + 7}*D{r_ss + 8}/7')
G.cell(r_ss + 10, 4, f'=D{r_ss}*D{r_ss + 9}')
G.cell(r_ss + 11, 4, f'=MAX(0,MIN(D{r_ss + 5},D{r_ss + 10}-D{r_ss}*D{r_ss + 2}))')
r = r_ss + len(ss_rows) + 1
for t in ['Lectura: con 98% de servicio necesitas ~5.800 kg de SS. Pero si el producto dura 50 días y la cadena más exigente acepta hasta 35% de avance,',
          'solo tienes 2,5 semanas para venderlo: máx. vendible 25.000 kg − 20.000 kg que vendes durante el lead time = SS topado en 5.000 kg. Producir más = merma.',
          'Z según nivel de servicio: 90% → 1,28 · 95% → 1,64 · 98% → 2,05 · 99% → 2,33.  Subir de 95% a 99% casi aumenta el SS en 42%.',
          'Dato pendiente: el lead time real por categoría (hoy se usa 1 semana por defecto). Cárgalo en Parametros y todo se recalcula.']:
    G.cell(r, 2, t).font = F_N
    r += 1

r += 1
G.cell(r, 2, '3. Gestión por excepción — rutina sugerida').font = F_ST
r += 1
for t in ['LUNES (30 min): actualizar archivos → hoja Excepciones → filtrar Prioridad 1-ALTA. Revisar ALERTA QUIEBRE y QUIEBRE ENCUBIERTO.',
          'LUNES: hoja Cadenas_vs_FCST → ¿qué cadena se desvió más? Llevar los SKU "SOBRE/BAJO FCST" a la reunión con KAM.',
          'Estados de stock: BAJO SS = stock + por liberar no alcanza el SS (crítico) · BAJO SS (XLIB CUBRE) = se salva solo si liberan a tiempo ·',
          'BAJO P.REORDEN = no es alerta, es la señal normal de programar producción · SOBRE MAX VENDIBLE = más stock del que se alcanza a vender dentro del filtro.',
          'MARTES-JUEVES (15 min/día): solo SKU AZ, AY y BZ + nuevas alertas. Ignorar los AX y CX salvo que tengan alerta.',
          'VIERNES (20 min): ALERTA MERMA/VU → lotes a ≤6 pts del filtro: priorizar despacho (FEFO) o venta intermedia antes de que se pierdan.',
          'MENSUAL: revisar WMAPE y sesgo en ABC_XYZ. Si un SKU tiene sesgo persistente > ±10%, corregir el forecast base, no parchar semana a semana.',
          'Regla de oro: si un SKU no tiene alerta, no lo toques. Tu tiempo vale más en los 30-50 SKU que sí la tienen.',
          'Las 4 alertas: QUIEBRE (stock bajo SS/reorden) · QUIEBRE ENCUBIERTO (hay stock pero no pasa el filtro de la cadena exigente) ·',
          'MERMA/VU (sobrestock vs vida útil o lotes fuera/cerca del filtro) · DESVIACIÓN (pedidos ±20% vs FCST en 4 semanas).']:
    G.cell(r, 2, t).font = F_N
    r += 1

for ws in wb.worksheets:
    ws.sheet_view.showGridLines = ws.title not in ('Como_usar',)
    for row in ws.iter_rows():
        for c in row:
            if c.value is not None and (c.font is None or c.font.name != AR):
                c.font = Font(name=AR, size=10, bold=c.font.bold, color=c.font.color, italic=c.font.italic)

wb.save(OUT)
print('ok', len(dem), len(st), len(cad))
