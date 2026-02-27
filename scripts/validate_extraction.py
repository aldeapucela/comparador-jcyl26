#!/usr/bin/env python3
"""Valida calidad y consistencia de un JSON de extracción de programa electoral.

Este script NO genera contenido. Solo detecta problemas para que el LLM
corrija títulos, resúmenes y estructura antes de dar por buena la extracción.
"""

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable, Optional

from PyPDF2 import PdfReader


ALLOWED_CATEGORIES = {
    "Sanidad Pública",
    "Educación y Futuro",
    "Servicios Sociales y Cuidados",
    "Reto Demográfico y Despoblación",
    "Vivienda",
    "Economía, Empleo y Fiscalidad",
    "Sector Primario (Agricultura y Ganadería)",
    "Medio Ambiente y Energía",
    "Conectividad y Movilidad",
    "Calidad Democrática y Transparencia",
    "Otros",
}

ALLOWED_COMPETENCIA = {"Directa", "Shared", "Petition"}

BAD_SUMMARY_PREFIXES = [
    "la propuesta establece",
    "la propuesta busca",
    "la iniciativa propone",
    "la medida plantea",
    "la medida propone",
    "la iniciativa plantea",
    "la propuesta impulsa",
    "la medida persigue",
    "se plantea",
]

CONNECTOR_ENDINGS = {
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "y",
    "o",
    "en",
    "con",
    "para",
    "como",
    "por",
    "a",
    "al",
    "que",
    "un",
    "una",
}

CATEGORY_SIGNALS = {
    "Sanidad Pública": [
        "sanidad",
        "salud",
        "atencion primaria",
        "hospital",
        "ambulancias",
    ],
    "Educación y Futuro": [
        "educacion",
        "escuela",
        "colegio",
        "universidad",
        "formacion profesional",
        "fp",
    ],
    "Sector Primario (Agricultura y Ganadería)": [
        "agric",
        "ganader",
        "campo",
        "pac",
        "macrogranjas",
        "biogas",
    ],
}


def norm_text(text: str) -> str:
    text = text.lower()
    text = "".join(
        ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn"
    )
    return re.sub(r"\s+", " ", text).strip()


def ends_with_connector(text: str) -> bool:
    stripped = text.strip().strip(".:;,!?")
    if not stripped:
        return False
    last = stripped.split()[-1].lower()
    return last in CONNECTOR_ENDINGS


def count_pdf_signals(pdf_path: Path) -> dict[str, int]:
    text = "\n".join((p.extract_text() or "") for p in PdfReader(str(pdf_path)).pages)
    ntext = norm_text(text)
    return {
        cat: sum(1 for kw in kws if kw in ntext) for cat, kws in CATEGORY_SIGNALS.items()
    }


def issue(issues: list[tuple[str, str]], level: str, msg: str) -> None:
    issues.append((level, msg))


def validate_file(path: Path, pdf_path: Optional[Path] = None) -> list[tuple[str, str]]:
    issues: list[tuple[str, str]] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [("ERROR", f"{path}: JSON inválido: {exc}")]

    if not isinstance(data, dict):
        return [("ERROR", f"{path}: la raíz debe ser un objeto JSON")]

    propuestas = data.get("propuestas")
    if not isinstance(propuestas, list):
        return [("ERROR", f"{path}: falta 'propuestas' o no es una lista")]

    if not propuestas:
        issue(issues, "ERROR", f"{path}: 'propuestas' está vacía")
        return issues

    # IDs
    ids = [p.get("id") for p in propuestas if isinstance(p, dict)]
    if len(ids) != len(propuestas):
        issue(issues, "ERROR", f"{path}: hay propuestas no-objeto")
    if any(not isinstance(i, int) for i in ids):
        issue(issues, "ERROR", f"{path}: todos los 'id' deben ser enteros")
    else:
        expected = list(range(1, len(propuestas) + 1))
        if ids != expected:
            issue(
                issues,
                "ERROR",
                f"{path}: IDs no correlativos desde 1 (esperado {expected[:3]}...{expected[-3:]})",
            )

    title_seen = defaultdict(list)
    quote_seen = defaultdict(list)
    cat_counter = Counter()

    for i, p in enumerate(propuestas, start=1):
        prefix = f"{path}: propuesta #{i}"
        if not isinstance(p, dict):
            issue(issues, "ERROR", f"{prefix}: no es objeto")
            continue

        # Required fields
        required = [
            "id",
            "categoria",
            "subcategoria",
            "titulo_corto",
            "resumen",
            "cita_literal",
            "pagina",
            "tags",
            "analisis",
            "pregunta_afinidad",
        ]
        for key in required:
            if key not in p:
                issue(issues, "ERROR", f"{prefix}: falta campo '{key}'")

        categoria = p.get("categoria")
        if categoria not in ALLOWED_CATEGORIES:
            issue(issues, "ERROR", f"{prefix}: categoría inválida '{categoria}'")
        else:
            cat_counter[categoria] += 1

        subcat = p.get("subcategoria")
        if not isinstance(subcat, str) or not subcat.strip():
            issue(issues, "ERROR", f"{prefix}: subcategoria vacía")

        titulo = p.get("titulo_corto")
        if not isinstance(titulo, str) or not titulo.strip():
            issue(issues, "ERROR", f"{prefix}: titulo_corto vacío")
            titulo = ""
        else:
            t = titulo.strip()
            nwords = len(t.split())
            if nwords < 3 or nwords > 14:
                issue(issues, "WARN", f"{prefix}: titulo_corto con {nwords} palabras")
            if "..." in t:
                issue(issues, "WARN", f"{prefix}: titulo_corto contiene '...'")
            if ends_with_connector(t):
                issue(
                    issues,
                    "WARN",
                    f"{prefix}: titulo_corto parece truncado (termina en conector)",
                )
            if re.search(r"[a-záéíóúñ][A-ZÁÉÍÓÚÑ][a-záéíóúñ]", t):
                issue(
                    issues,
                    "WARN",
                    f"{prefix}: posible palabra con mayúscula interna anómala en título",
                )
            title_seen[norm_text(t)].append(i)

        resumen = p.get("resumen")
        if not isinstance(resumen, str) or not resumen.strip():
            issue(issues, "ERROR", f"{prefix}: resumen vacío")
            resumen = ""
        else:
            r = resumen.strip()
            nr = norm_text(r)
            nt = norm_text(titulo) if isinstance(titulo, str) else ""
            if len(r.split()) < 7:
                issue(issues, "WARN", f"{prefix}: resumen demasiado corto")
            if "..." in r:
                issue(issues, "WARN", f"{prefix}: resumen contiene '...' (posible truncado)")
            if any(nr.startswith(pref) for pref in BAD_SUMMARY_PREFIXES):
                issue(
                    issues,
                    "WARN",
                    f"{prefix}: resumen usa prefijo plantilla repetitivo",
                )
            if nt and nr.startswith(nt):
                issue(
                    issues,
                    "WARN",
                    f"{prefix}: resumen arranca repitiendo el título",
                )
            if nt and nr == nt:
                issue(issues, "WARN", f"{prefix}: resumen idéntico al título")

        cita = p.get("cita_literal")
        if not isinstance(cita, str) or not cita.strip():
            issue(issues, "ERROR", f"{prefix}: cita_literal vacía")
            cita = ""
        else:
            c = cita.strip()
            if "..." in c:
                issue(issues, "WARN", f"{prefix}: cita_literal contiene '...'")
            if not re.search(r"[.!?]$", c):
                issue(
                    issues,
                    "WARN",
                    f"{prefix}: cita_literal no termina en puntuación fuerte",
                )
            if ends_with_connector(c):
                issue(issues, "WARN", f"{prefix}: cita_literal parece truncada")
            quote_seen[norm_text(c)].append(i)

        pagina = p.get("pagina")
        if not isinstance(pagina, int) or pagina <= 0:
            issue(issues, "ERROR", f"{prefix}: pagina debe ser entero > 0")

        tags = p.get("tags")
        if not isinstance(tags, list):
            issue(issues, "ERROR", f"{prefix}: tags debe ser lista")
        else:
            for tg in tags:
                if not isinstance(tg, str) or not tg.startswith("#"):
                    issue(issues, "WARN", f"{prefix}: tag inválido '{tg}'")

        analisis = p.get("analisis")
        if not isinstance(analisis, dict):
            issue(issues, "ERROR", f"{prefix}: analisis debe ser objeto")
        else:
            comp = analisis.get("competencia")
            foco = analisis.get("foco_rural")
            if comp not in ALLOWED_COMPETENCIA:
                issue(issues, "ERROR", f"{prefix}: competencia inválida '{comp}'")
            if not isinstance(foco, bool):
                issue(issues, "ERROR", f"{prefix}: foco_rural debe ser booleano")

        pregunta = p.get("pregunta_afinidad")
        if not isinstance(pregunta, str) or not pregunta.strip():
            issue(issues, "ERROR", f"{prefix}: pregunta_afinidad vacía")
        else:
            q = pregunta.strip()
            if not (q.startswith("¿") and q.endswith("?")):
                issue(
                    issues,
                    "WARN",
                    f"{prefix}: pregunta_afinidad debería abrir con '¿' y cerrar con '?'",
                )
            if len(q) > 220:
                issue(issues, "WARN", f"{prefix}: pregunta_afinidad demasiado larga")

    # Duplicates
    for norm_title, locs in title_seen.items():
        if norm_title and len(locs) > 1:
            issue(
                issues,
                "WARN",
                f"{path}: título duplicado en propuestas {locs}",
            )
    for norm_quote, locs in quote_seen.items():
        if norm_quote and len(locs) > 1:
            issue(
                issues,
                "WARN",
                f"{path}: cita_literal duplicada en propuestas {locs}",
            )

    # Optional coverage sanity using PDF signals.
    if pdf_path is not None:
        try:
            signals = count_pdf_signals(pdf_path)
            for cat, hits in signals.items():
                if hits >= 3 and cat_counter[cat] == 0:
                    issue(
                        issues,
                        "WARN",
                        f"{path}: posible subextracción en '{cat}' (señales PDF={hits}, propuestas=0)",
                    )
        except Exception as exc:
            issue(issues, "WARN", f"{path}: no se pudo analizar PDF '{pdf_path}': {exc}")

    return issues


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Valida calidad de archivos JSON de extracción electoral."
    )
    parser.add_argument("json_files", nargs="+", help="Rutas a JSON de partidos")
    parser.add_argument(
        "--pdf",
        help="Ruta a PDF original para chequeo de señales (solo válido con 1 JSON)",
    )
    parser.add_argument(
        "--fail-on-warning",
        action="store_true",
        help="Devuelve código de error si hay warnings",
    )
    return parser.parse_args(list(argv))


def main(argv: Iterable[str]) -> int:
    args = parse_args(argv)

    json_paths = [Path(p) for p in args.json_files]
    pdf_path = Path(args.pdf) if args.pdf else None
    if pdf_path and len(json_paths) != 1:
        print("ERROR: --pdf solo se admite cuando se valida un único JSON.")
        return 2

    all_issues: list[tuple[str, str]] = []
    for path in json_paths:
        issues = validate_file(path, pdf_path=pdf_path if len(json_paths) == 1 else None)
        all_issues.extend(issues)

    err_count = sum(1 for level, _ in all_issues if level == "ERROR")
    warn_count = sum(1 for level, _ in all_issues if level == "WARN")

    for level, msg in all_issues:
        print(f"[{level}] {msg}")
    print(f"\nResumen: {err_count} errores, {warn_count} warnings")

    if err_count > 0:
        return 2
    if warn_count > 0 and args.fail_on_warning:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
