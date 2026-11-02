# DoseScape engines — specification

Six calculators, one self-contained HTML page each (inline CSS + JS, no
framework, no build step, no network requests). This file is the contract:
every formula here is implemented verbatim in the page's `<script>`, with the
derivation repeated in code comments. Where the chemistry or the hobby data is
contested or unverified, it is marked **⚑ FLAG** here and footnoted on the page.

| Engine | Path |
| --- | --- |
| Tank volume | `/tank-volume/` |
| EI dosing | `/ei-dosing/` |
| PPS-Pro dosing | `/pps-pro/` |
| RO/DI remineralization | `/remineralization/` |
| pH/KH → CO2 | `/co2/` |
| Triangle balancer | `/triangle/` |

The water-column volume from the tank page is saved in `localStorage`
(`finsflora.volumeL`) and pre-fills the volume field on the EI and PPS-Pro pages (the remineralization
page asks for the volume of change water instead). All
storage access is wrapped in try/catch; pages work without it.

---

## 0. Shared constants

Atomic masses (IUPAC conventional, g/mol): K 39.098 · N 14.007 · O 15.999 ·
P 30.974 · H 1.008 · S 32.06 · Ca 40.078 · Mg 24.305 · C 12.011 · Na 22.990.

| Compound | M (g/mol) | Ion mass fractions |
| --- | --- | --- |
| KNO3 | 101.102 | NO3 0.61328 · K 0.38672 · (N 0.13854) |
| KH2PO4 | 136.084 | PO4 0.69788 · K 0.28731 |
| K2SO4 | 174.252 | K 0.44875 · SO4 0.55125 |
| MgSO4·7H2O | 246.466 | Mg 0.09861 · SO4 0.38975 |
| MgSO4 (anhydrous) | 120.361 | Mg 0.20193 |
| CaSO4·2H2O | 172.164 | Ca 0.23279 |
| CaSO4 (anhydrous) | 136.134 | Ca 0.29440 |
| KHCO3 | 100.114 | — |
| NaHCO3 | 84.006 | — |

Unit conversions:

- 1 US gal = 3.785411784 L; 1 UK gal = 4.54609 L; 1 in = 2.54 cm.
- ppm is taken as mg/L (exact enough for fresh water, density ≈ 1).
- **1 dGH** = 10 mg CaO/L = 10 / 56.077 = **0.178326 mmol/L** of (Ca²⁺ + Mg²⁺).
- **1 dKH** = the alkalinity equivalent of 1 dGH = **0.356652 mmol/L HCO3⁻**
  (= 17.848 mg/L as CaCO3).

Core dosing identity used by every fertilizer engine:

```
grams_of_salt = target_ppm_of_ion × volume_L / (ion_mass_fraction × 1000)
ppm_of_ion    = grams_of_salt × 1000 × ion_mass_fraction / volume_L
```

No-uptake ceiling (used by EI and PPS-Pro): if D ppm is added per week and a
fraction f of the water is changed once a week, the level just before the
change converges to `C = D / f` and just after to `(1 − f)·C`.
Derivation: at steady state, `C_after = (1 − f)(C_after + D)` ⇒
`C_after = D(1 − f)/f`, and `C_before = C_after + D = D/f`. Plant uptake only
lowers this, so it is an upper bound, not a prediction.

---

## 1. Tank volume

**Inputs:** unit (cm / in); length, width, height; whether they are outside or
inside measurements; glass thickness (mm, outside only); gap from water surface
to rim; substrate depth at front and at back; substrate type → porosity φ
(sand 0.38, gravel 0.38, aquasoil 0.55, or custom); hardscape volume (L,
optional).

**Formulas** (all lengths converted to cm, volumes cm³ ÷ 1000 → L):

```
Li = L − 2t,  Wi = W − 2t,  Hi = H − t        (outside dims; t = glass)
hw = Hi − gap                                  (water height)
d  = (d_front + d_back) / 2                    (linear slope ⇒ mean depth)
V_nominal   = L·W·H                            (what the box says)
V_wet       = Li·Wi·hw                         (glass box filled to waterline)
V_substrate = Li·Wi·d                          (bulk substrate volume)
V_pore      = V_substrate · φ
V_column    = V_wet − V_substrate − V_hardscape     ← primary output
V_total     = V_column + V_pore
```

**Outputs:** water column (L, US gal, UK gal) — the number to dose and size
water changes against; plus nominal, internal, substrate bulk, pore water,
total water, and substrate bulk volume (for buying bags).

⚑ FLAG — *Which volume to dose against.* Pore water in the substrate exchanges
slowly with the column. We treat the free column as the dosing volume and show
pore water separately rather than choosing silently.
⚑ FLAG — *Porosity values* are typical packed-bed figures (sand/gravel 0.35–0.40).
Aquasoil granules are themselves porous; 0.55 is a reasonable midpoint, not a
measured constant. Custom value accepted.
⚑ FLAG — *Rimless assumption.* Outside dimensions assume a standard rimless
build (bottom panel under the side panels). Framed tanks or raised bottoms
differ; inside measurements are exact.

---

## 2. EI dosing (Estimative Index, dry salts)

**Inputs:** tank volume (L / US gal / UK gal); per-dose targets: NO3 ppm,
PO4 ppm, *additional* K ppm from K2SO4, Fe ppm from CSM+B; CSM+B iron content
(% Fe, default 6.53); weekly water change %; teaspoon densities (g per level
US tsp) for each salt.

**Default per-dose targets:** NO3 7.5 · PO4 1.3 · extra K 3.0 · Fe 0.10 ppm,
dosed 3×/week (≈ 22.5 NO3 / 3.9 PO4 / 26 K / 0.3 Fe ppm per week).

**Formulas:**

```
g_KNO3   = NO3_target × V / (0.61328 × 1000)
g_KH2PO4 = PO4_target × V / (0.69788 × 1000)
g_K2SO4  = K_extra    × V / (0.44875 × 1000)
g_CSM    = Fe_target  × V / ((Fe% / 100) × 1000)

K_total per dose = NO3·(39.098/62.004) + PO4·(39.098/94.970) + K_extra
NO3-N = NO3 × 14.007/62.004        (for kits that report nitrate-nitrogen)
tsp   = grams / density_g_per_tsp
```

CSM+B co-delivered elements are reported from the label composition
(Fe 6.53, Mn 1.87, Zn 0.40, Cu 0.09, Mo 0.05, B 1.18, Mg 1.50 %) scaled by the
entered Fe % so the ratios hold.

**Schedule output:** Mon/Wed/Fri macros (KNO3, KH2PO4, K2SO4); Tue/Thu/Sat
micros (CSM+B) — kept on separate days because phosphate and chelated
iron/trace metals can precipitate together; Sun water change (f %) then
restart. Weekly totals and no-uptake ceilings (`3·dose / f`) per ion.

**Outputs:** per dose — grams, teaspoons (decimal + nearest measuring-spoon
combination to 1/32 tsp), ppm delivered per ion; weekly schedule; ceilings.

⚑ FLAG — *EI targets are a range, not a point.* Commonly cited weekly EI levels
are ~20–30 ppm NO3, ~3 ppm PO4, ~20–30 ppm K, ~0.5 ppm Fe. The circulated
teaspoon charts back-calculate to higher per-dose values than our defaults
(the page computes this live at 20 US gal using the user's densities). Excess
is EI's premise; the water change is the cap.
⚑ FLAG — *Teaspoon densities* depend on crystal size and packing. Defaults
(KNO3 5.9, KH2PO4 5.8, K2SO4 6.3, CSM+B 5.0 g/tsp) are typical figures, not
verified constants. Grams are exact; teaspoons are only as good as the density.
The page tells users how to calibrate (weigh 5 level tsp, divide by 5).
⚑ FLAG — *CSM+B iron* is reported at 6.53 % on the Plantex CSM+B label; other
trace mixes differ, hence the editable Fe % field.

---

## 3. PPS-Pro dosing (daily, from stock solutions)

**Inputs:** tank volume; bottle size (mL, final volume after topping up);
daily dose per bottle (mL; default auto = 1 mL per 10 US gal); daily targets:
NO3, PO4, Mg, extra K (K2SO4, default 0), Fe; CSM+B Fe %; weekly water
change %.

**Reference recipe** (the circulated PPS-Pro standard; targets default to what
it delivers):

- Macro: 500 mL water + 58 g KNO3 + 4 g KH2PO4 + 33 g MgSO4·7H2O
- Micro: 500 mL water + 8 g CSM+B
- Dose: 1 mL of each per 10 US gal (37.854 L) per day

Derived default daily targets (`ppm = g/500 mL × 1000 mg/g × 1 mL / 37.854 L × fraction`):

| Ion | ppm / day |
| --- | --- |
| NO3 | 1.879 |
| PO4 | 0.147 |
| K (from KNO3 + KH2PO4) | 1.246 |
| Mg | 0.172 |
| Fe | 0.0276 |

**Formulas:**

```
doses_per_bottle = bottle_mL / dose_mL
g_salt_in_bottle = target_ppm × V / (fraction × 1000) × doses_per_bottle
days_per_bottle  = doses_per_bottle          (one dose/day)
concentration    = g_salt / bottle_mL × 100  (g per 100 mL, for solubility)
weekly           = 7 × daily;  ceiling = weekly / f
```

Solubility check (20 °C, single salt, g per 100 mL water): KNO3 31.6,
KH2PO4 22.6, K2SO4 11.1, MgSO4·7H2O 71. The page warns above 60 % of any
limit and errors above 100 %.

**Outputs:** grams per bottle for each salt (macro and micro bottles), mL to
dose daily, days per bottle, delivered ppm/day, weekly total, no-uptake
ceiling — shown next to the EI weekly figures for comparison.

⚑ FLAG — *Recipe provenance.* The 58/4/33 g and 8 g CSM+B per 500 mL figures
are the widely circulated PPS-Pro recipe; we could not verify them against the
original author's page from here. Targets are editable for anyone whose
source differs.
⚑ FLAG — *Mixed-salt solubility.* The single-salt limits overstate what a
mixed macro bottle holds (shared K⁺ lowers solubility). Hence the 60 % warning.

---

## 4. RO/DI remineralization

**Inputs:** water volume (L / US gal / UK gal); target GH and KH; source-water
GH and KH (default 0 for RO/DI); unit for hardness (°dH or ppm as CaCO3);
Ca:Mg mass ratio (default 3:1); Ca salt (CaSO4·2H2O or anhydrous CaSO4);
Mg salt (MgSO4·7H2O or anhydrous); KH salt (KHCO3 or NaHCO3).

**Formulas:**

```
ΔGH (dGH) = max(0, GH_target − GH_source);  ΔKH likewise
n_hard  (mmol/L) = ΔGH × 0.178326             (Ca + Mg together)
mass ratio r = Ca_mg/L : Mg_mg/L
    Ca:Mg molar ratio q = r × 24.305 / 40.078
    n_Mg = n_hard / (1 + q),  n_Ca = n_hard − n_Mg
n_HCO3 (mmol/L) = ΔKH × 0.356652
g_CaSalt = n_Ca   × M_CaSalt × V / 1000
g_MgSalt = n_Mg   × M_MgSalt × V / 1000
g_KHSalt = n_HCO3 × M_KHSalt × V / 1000
ppm_as_CaCO3 = dH × 17.848
```

Added ions (mg/L) reported: Ca, Mg, SO4, K or Na, HCO3, and their sum.

**Outputs:** grams of each salt for the stated volume; ions added; a warning
when CaSO4 exceeds ~2.0 g/L (gypsum solubility ≈ 2.4 g/L at 20 °C — it
dissolves slowly and may not fully dissolve).

⚑ FLAG — *Ca:Mg ratio.* 3:1 to 4:1 by mass is the common hobby guidance; there
is no consensus optimum and some shrimp keepers use lower. Editable; the page
shows the molar ratio too.
⚑ FLAG — *Sulfate load.* All-sulfate GH boosters add SO4; at usual targets this
is modest (reported, not judged).

---

## 5. pH/KH → CO2

**Mode A — pH + KH.** Inputs: pH, KH (°dKH or ppm CaCO3), temperature
(°C / °F), measurement uncertainty (pH ±, KH ±).

Derivation: `CO2(aq) + H2O ⇌ H⁺ + HCO3⁻`, `K1 = [H⁺][HCO3⁻]/[CO2]`, so

```
[CO2] mol/L = [HCO3⁻] × 10^(pK1 − pH)
[HCO3⁻]     = KH × 0.356652e-3                (all KH assumed to be bicarbonate)
CO2 mg/L    = 44.009 × 0.356652 × KH × 10^(pK1 − pH)
            = 15.696 × 10^(pK1 − 7) × KH × 10^(7 − pH)
```

- **Chart formula:** `CO2 = 3.0 × KH × 10^(7 − pH)` — equivalent to pK1 = 6.281.
- **Temperature-corrected:** pK1(T) = 3404.71/T + 0.032786·T − 14.8435
  (T in K; Harned & Davis 1943). 25 °C → 6.351 (constant 3.52);
  20 °C → 6.382 (3.78); 28 °C → 6.336 (3.40).
- **Uncertainty band:** min/max of the chosen formula over pH ± δpH and
  KH ± δKH.

The page renders the classic grid (KH 1–10 × pH 6.0–7.6) with the user's cell
marked.

**Mode B — pH drop.** Inputs: degassed pH (sample left out ~24 h), tank pH
at lights-on peak, temperature, room-air CO2 (ppm, default 420).

```
CO2_tank = CO2_degassed × 10^(pH_degassed − pH_tank)
CO2_degassed (Henry) = kH(T) × pCO2_atm × 44009 mg/mol
kH(T) = 0.034 × exp(2400 × (1/T − 1/298.15))   mol/(L·atm)
```

The hobby convention (`CO2_degassed = 3 ppm`, so a 1.0 drop ≈ 30 ppm) is shown
alongside.

**Outputs:** CO2 ppm (both formulas), uncertainty range, grid, pH-drop
estimate.

⚑ FLAG — *Low KH.* The chart assumes every unit of KH is bicarbonate. Other
buffers (humic/tannic acids from aquasoil and wood, phosphate, borate) inflate
KH relative to bicarbonate and inflate the CO2 reading; the relative error
grows as KH falls, and kit resolution (±1 drop ≈ ±0.5–1 dKH) is itself ±25–50 %
at KH 2. The page shows the band rather than a single number.
⚑ FLAG — *Chart constant vs. theory.* The "3" matches theory only with
roughly an ionic-strength (activity) correction applied; our temperature-
corrected figure ignores activity (γ_HCO3 ≈ 0.90–0.95 in typical tank water
would lower it by 5–10 %). Both numbers are shown; neither is declared right.
⚑ FLAG — *pH-drop baseline.* Henry's law at 420 ppm air gives ≈ 0.6 ppm
degassed CO2; the 3 ppm hobby convention is ~5× that. Indoor air is often
600–1500 ppm CO2 and "degassed" samples are seldom fully equilibrated. Both
are shown; the ratio (10^ΔpH) is robust regardless.

---

## 6. Triangle balancer (light–CO₂–nutrient coupling)

**Posture.** Engines 1–5 compute chemistry: their constants are molar masses
and equilibrium constants. This engine computes *balance*, and its constants
are the hobby's working conventions (PAR bands, EI weekly ranges, the 3 ppm
ambient convention §5 already prints). Every table below is a named constants
table, every convention is ⚑-flagged here and footnoted on the page, and all
of them live in one constants object (`TCONST`) at the top of the page's
engine block, so the doctrine changes in exactly one place. What the engine
guarantees is not that the bands are laws — it's that the *comparison*
(required vs supplied, per corner, with the limiting corner named) is
computed consistently and shown in full.

**Scope.** Bands and sufficiency only: no dosing math (engines 2 and 3 own
grams), and no bubble-rate output (diffuser, surface agitation and outgassing
dominate it — no defensible constant exists). Volume is context and hand-off
only; the page reads `finsflora.volumeL` and writes no storage keys.

**Inputs:** PAR at substrate (µmol·m⁻²·s⁻¹) or a light class (Low ≈ 20 ·
Medium ≈ 40 · High ≈ 80, nominal stand-ins ⚑); photoperiod (h/day,
0 < h ≤ 24); CO₂ method (none / liquid carbon / DIY yeast / pressurized with
a target ppm, default 30); plant density; livestock; nutrient regime (or a
custom weekly NO₃).

**Light — the driver corner:**

```
DLI_sub (mol·m⁻²·day⁻¹) = PAR × photoperiod_h × 0.0036     (3600 s/h ÷ 10⁶ µmol/mol)
```

| Band | PAR | Required CO₂ (ppm) | Required NO₃ (ppm/week, moderate density) |
| --- | --- | --- | --- |
| Low | < 25 | 3 (ambient — none required) | 5 |
| Medium | 25 ≤ PAR < 50 | 20 | 12 |
| High | 50 ≤ PAR ≤ 100 | 30 | 22.5 |
| Very high | > 100 | 30 — capped | 22.5 — capped |

Banding is on PAR (intensity), not DLI — hobby CO₂ guidance keys on
intensity; photoperiod enters via DLI (displayed) and flag R3. Required
PO₄/K/Fe are derived from required NO₃ at §2's EI weekly proportions,
carried as the fractions 3.9/22.5, 26/22.5, 0.30/22.5 so the round-trip to
§2's printed week is exact.

**CO₂ — supplied vs required:**

| Method | Supplied ppm | Stability | Note |
| --- | --- | --- | --- |
| None | 3 | 1.0 | The ambient-equilibrium convention of §5, Mode B |
| Liquid carbon | 10 | 0.85 | ⚑ modelling credit — glutaraldehyde is not CO₂ |
| DIY yeast | 20 | 0.6 | ⚑ stability models output sag/swing |
| Pressurized | user's target | 1.0 | Solenoid-on-timer assumed |

Livestock cap: hardy/none 35 ppm; shrimp or sensitive 25 ppm. A pressurized
target above the cap is scored at the cap, with a warning.

```
s_co2 = min(1, supplied_capped / required) × stability
```

**Nutrients — supplied vs required.** Required NO₃ = band figure × density
multiplier (sparse 0.7 · moderate 1.0 · dense 1.3 ⚑). Supplied weekly ppm:

| Regime | NO₃ | PO₄ | K | Fe | Source |
| --- | --- | --- | --- | --- | --- |
| EI | 22.5 | 3.9 | 26 | 0.30 | §2's printed week |
| PPS-Pro | 13.153 | 1.029 | 8.722 | 0.1932 | §3 daily targets × 7 |
| Lean bottled | 7.5 | — | — | — | ⚑ nominal label-dose figure |
| Root tabs only | 2 | — | — | — | ⚑ nominal water-column credit |
| None | 0 | 0 | 0 | 0 | Livestock waste real but unquantified — stated, not modelled |
| Custom | user's NO₃ | ×3.9/22.5 | ×26/22.5 | ×0.30/22.5 | EI-ratio derivation |

```
s_nut = min(1, supplied_NO3 / required_NO3)
```

Sufficiency is judged on NO₃ as the proxy ion (stated on the page); the
supplied/required table displays all four ions where the regime defines them.

**Verdict.** Limiting corner = min(s_co2, s_nut); both ≥ 0.9 → **In
balance**. The verdict names the limiter and its percentage, never a bare
score.

**Triangle (visual + barycentric position).** Corners: Light (0.5, √3/2) ·
CO₂ (0, 0) · Nutrients (1, 0). Intensities, each capped at 1:

```
iL = min(1, PAR / 100)   iC = min(1, co2_supplied_capped / 30)   iN = min(1, no3_supplied / 22.5)
w_i = i_i / (iL + iC + iN)          P = wL·Light + wC·CO₂ + wN·Nutrients
```

If the intensities sum to 0, no point is plotted. The plot is a *position*
visual; the verdict is computed from the sufficiencies, not from the plot,
and the page says so.

**Algae-risk flags (deterministic; every flag prints its reason):**

| Rule | Fires when | Level |
| --- | --- | --- |
| R1 | band ≥ High AND s_co2 < 0.70 | High — "the classic BBA setup: full fertilizer, high light, no carbon" |
| R2 | band ≥ High AND s_nut < 0.60 | High — deficiency symptoms and algae pressure together |
| R3 | photoperiod > 10 h | Watch — algae get hours the plants can't use |
| R4 | s_co2 < 0.85 or s_nut < 0.85 (and no High fired) | Watch — names the corner under 85% |
| R5 | supplied NO₃ > 1.5 × required AND band ≤ Medium | Note (not risk) — EI doctrine: excess alone doesn't grow algae, but it's waste ⚑ |

Overall risk = worst fired (High > Watch > none). No flag → "No imbalance
flags at these settings."

**"Change one lever" — the ordered fix list (deterministic):**

1. s_co2 < s_nut and s_co2 < 0.9 → the CO₂ lever (method-aware wording: DIY
   shortfall is a *stability* problem, not an amount problem). If the method
   can't reach the requirement, print the equivalent light-side move: the
   PAR ceiling of the highest band whose required CO₂ ≤ supplied
   (e.g. supplied 3 ppm → stay under PAR 25).
2. Else s_nut < 0.9 → the nutrient lever: step the regime up one rung
   (none → root tabs → lean → PPS-Pro → EI) or set custom NO₃ to the
   required figure; engines 2/3 do the grams.
3. Else photoperiod > 10 h → the light-duration lever (cut to 8–10 h).
4. Else → "No lever to pull — hold settings and observe."

Special case: if required CO₂ > livestock cap, the CO₂ lever is replaced by
the **light lever** (bring PAR under the top of the highest band whose
requirement fits under the cap).

**Display.** Internal math unrounded. Sufficiency as whole %; ppm to 1
decimal (Fe 2); DLI to 2 decimals; triangle coordinates not displayed.

⚑ FLAG — *Band edges and required-CO₂ figures* are hobby convention (the
ranges EI/PPS practice is built around), not measured optima. PAR at the
substrate is itself usually estimated; the page shows the band the tank
falls in, not a false-precision point.
⚑ FLAG — *Liquid-carbon credit.* Glutaraldehyde delivers no measurable CO₂
ppm; 10 ppm is a modelling credit for its real but partial effect — the
softest number in this engine.
⚑ FLAG — *Stability factors* (DIY 0.6, liquid 0.85) are conventions
modelling output sag and swing, not measurements of any particular rig.
⚑ FLAG — *Density multipliers* are a heuristic: plant mass is the nutrient
sink, but light alone doesn't set uptake.
⚑ FLAG — *Nominal regime figures.* Lean-bottled 7.5 and root-tab 2 ppm have
no repo constant behind them; they are label-dose and water-column-credit
stand-ins, marked as such on the page.
⚑ FLAG — *Livestock caps* (35/25 ppm) are hobby safety convention, not
toxicology.
⚑ FLAG — *Requirement caps.* Past ~30 ppm CO₂ and the top of the §2 EI
weekly range, more input stops being the answer — the excess is in the
light, and the lever list says so.
