#!/usr/bin/env python3
"""Normaliza y homogeneiza tags de propuestas para todos los partidos.

Reglas:
- Canonicaliza aliases (acentos/variantes) a un único tag.
- Garantiza un tag macro por categoria.
- Garantiza minimo 2 tags por propuesta.
- Limita a maximo 4 tags priorizados para evitar ruido.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PARTY_FILES = [
    ROOT / "data" / "partidos" / "pp.json",
    ROOT / "data" / "partidos" / "psoe.json",
    ROOT / "data" / "partidos" / "en-comun.json",
    ROOT / "data" / "partidos" / "mev.json",
    ROOT / "data" / "partidos" / "vox.json",
]

ALIAS_MAP = {
    "#Digitalización": "#Digitalizacion",
    "#Financiación": "#Financiacion",
    "#ViolenciaGénero": "#ViolenciaGenero",
    "#Corrupción": "#Corrupcion",
    "#Modernización": "#Modernizacion",
    "#CargaEléctrica": "#CargaElectrica",
    "#Satélite": "#Satelite",
    "#Sanidad": "#SanidadPublica",
    "#Servicios": "#ServiciosPublicos",
    "#Toros": "#Tauromaquia",
    "#Tradicion": "#Tradiciones",
    "#Publi-Privada": "#ColaboracionPublicoPrivada",
}

CATEGORY_PRIMARY = {
    "Sanidad Pública": "#SanidadPublica",
    "Educación y Futuro": "#Educacion",
    "Servicios Sociales y Cuidados": "#ServiciosSociales",
    "Reto Demográfico y Despoblación": "#RetoDemografico",
    "Vivienda": "#Vivienda",
    "Economía, Empleo y Fiscalidad": "#Empleo",
    "Sector Primario (Agricultura y Ganadería)": "#SectorPrimario",
    "Medio Ambiente y Energía": "#MedioAmbiente",
    "Conectividad y Movilidad": "#Movilidad",
    "Calidad Democrática y Transparencia": "#Transparencia",
    "Otros": "#Derechos",
}

CATEGORY_SECONDARY = {
    "Sanidad Pública": ["#Salud", "#AtencionPrimaria"],
    "Educación y Futuro": ["#Formacion", "#Universidad"],
    "Servicios Sociales y Cuidados": ["#Cuidados", "#Dependencia"],
    "Reto Demográfico y Despoblación": ["#Despoblacion", "#MedioRural"],
    "Vivienda": ["#Alquiler", "#ViviendaAsequible"],
    "Economía, Empleo y Fiscalidad": ["#Fiscalidad", "#Pymes"],
    "Sector Primario (Agricultura y Ganadería)": ["#Agricultura", "#Ganaderia"],
    "Medio Ambiente y Energía": ["#Energia", "#Renovables"],
    "Conectividad y Movilidad": ["#TransportePublico", "#Digitalizacion"],
    "Calidad Democrática y Transparencia": ["#Gobernanza", "#Participacion"],
    "Otros": ["#Cultura", "#Igualdad"],
}

TAG_PRIORITY = [
    "#SanidadPublica",
    "#Salud",
    "#AtencionPrimaria",
    "#Hospitales",
    "#Urgencias",
    "#SaludMental",
    "#Educacion",
    "#Formacion",
    "#FormacionProfesional",
    "#Universidad",
    "#Becas",
    "#ServiciosSociales",
    "#Cuidados",
    "#Dependencia",
    "#ExclusionSocial",
    "#RetoDemografico",
    "#Despoblacion",
    "#MedioRural",
    "#Vivienda",
    "#Alquiler",
    "#ViviendaPublica",
    "#ViviendaAsequible",
    "#Rehabilitacion",
    "#Empleo",
    "#Fiscalidad",
    "#Pymes",
    "#Autonomos",
    "#Industria",
    "#Comercio",
    "#Turismo",
    "#SectorPrimario",
    "#Agricultura",
    "#Ganaderia",
    "#PAC",
    "#Regadio",
    "#MedioAmbiente",
    "#Energia",
    "#Renovables",
    "#Agua",
    "#Forestal",
    "#Reciclaje",
    "#Movilidad",
    "#TransportePublico",
    "#TransporteADemanda",
    "#Tren",
    "#Infraestructuras",
    "#Digitalizacion",
    "#Transparencia",
    "#Antifraude",
    "#Corrupcion",
    "#Gobernanza",
    "#Participacion",
    "#Derechos",
    "#DerechosHumanos",
    "#Igualdad",
    "#ViolenciaGenero",
    "#LGTBI",
    "#Cultura",
    "#Patrimonio",
    "#MemoriaHistorica",
    "#Valladolid",
]

PRIORITY_RANK = {tag: idx for idx, tag in enumerate(TAG_PRIORITY)}


def canonicalize_tag(tag: str) -> str:
    return ALIAS_MAP.get(tag, tag)


def normalize_proposal_tags(categoria: str, tags: list[str]) -> list[str]:
    primary = CATEGORY_PRIMARY.get(categoria)
    secondary = CATEGORY_SECONDARY.get(categoria, [])

    normalized = []
    seen = set()

    for raw in tags:
        if not isinstance(raw, str):
            continue
        raw = raw.strip()
        if not raw.startswith("#"):
            continue
        tag = canonicalize_tag(raw)
        if tag == "#Otros":
            continue
        if tag not in seen:
            normalized.append(tag)
            seen.add(tag)

    if primary and primary not in seen:
        normalized.insert(0, primary)
        seen.add(primary)

    if len(normalized) < 2:
        for tag in secondary:
            if tag not in seen:
                normalized.append(tag)
                seen.add(tag)
            if len(normalized) >= 2:
                break

    # Prioriza tags macro + semanticos; evita crecimiento sin control.
    normalized.sort(key=lambda t: PRIORITY_RANK.get(t, 999))
    if len(normalized) > 4:
        normalized = normalized[:4]

    return normalized


def run(write: bool) -> None:
    for path in PARTY_FILES:
        data = json.loads(path.read_text(encoding="utf-8"))
        propuestas = data.get("propuestas", [])

        before = Counter(
            tag for p in propuestas for tag in p.get("tags", []) if isinstance(tag, str)
        )

        for p in propuestas:
            p["tags"] = normalize_proposal_tags(p.get("categoria", ""), p.get("tags", []))

        after = Counter(
            tag for p in propuestas for tag in p.get("tags", []) if isinstance(tag, str)
        )

        if write:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        tcounts = [len(p.get("tags", [])) for p in propuestas] or [0]
        print(
            f"{path.name}: unique {len(before)} -> {len(after)} | "
            f"avg={sum(tcounts)/len(tcounts):.2f} min={min(tcounts)} max={max(tcounts)}"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normaliza tags de todos los partidos.")
    parser.add_argument("--write", action="store_true", help="Escribe cambios en disco")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(write=args.write)
