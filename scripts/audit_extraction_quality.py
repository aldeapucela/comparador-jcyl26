#!/usr/bin/env python3
import json
import re
import unicodedata
from pathlib import Path

from PyPDF2 import PdfReader


ROOT = Path(__file__).resolve().parents[1]

PARTIES = [
    ("pp", "PP"),
    ("psoe", "PSOE"),
    ("en-comun", "EN_COMUN"),
    ("mev", "MEV"),
]

# Minimal keyword signals per category to catch obvious misses.
CATEGORY_SIGNALS = {
    "Sanidad Pública": [
        "sanidad",
        "salud",
        "atencion primaria",
        "hospital",
        "ambulancias",
        "cribados",
    ],
    "Educación y Futuro": [
        "educacion",
        "escuela",
        "colegio",
        "universidad",
        "fp",
        "formacion profesional",
    ],
    "Sector Primario (Agricultura y Ganadería)": [
        "agric",
        "ganader",
        "pac",
        "campo",
        "regadio",
    ],
    "Vivienda": ["vivienda", "alquiler", "hipoteca"],
    "Servicios Sociales y Cuidados": [
        "dependencia",
        "residencias",
        "cuidados",
        "mayores",
        "ceas",
    ],
}


def norm(text: str) -> str:
    text = text.lower()
    text = "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"\s+", " ", text).strip()


def read_pdf_text(pdf_path: Path) -> tuple[str, int]:
    reader = PdfReader(str(pdf_path))
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    return text, len(reader.pages)


def signal_hits(pdf_text_norm: str, keywords: list[str]) -> int:
    return sum(1 for k in keywords if k in pdf_text_norm)


def extract_bullets(pdf_text: str) -> list[str]:
    bullets = []
    for raw in pdf_text.split("•"):
        txt = " ".join(raw.split())
        if len(txt) < 60:
            continue
        if txt.startswith("BORRADOR EJES PROGRAM"):
            continue
        bullets.append(txt)
    return bullets


def citation_coverage(bullets: list[str], citas: list[str]) -> tuple[int, int]:
    nbul = len(bullets)
    if not nbul:
        return 0, 0
    bullets_norm = [norm(b) for b in bullets]
    covered = 0
    for b in bullets_norm:
        ok = False
        for c in citas:
            nc = norm(c)
            if len(nc) < 20:
                continue
            if nc in b:
                ok = True
                break
        if ok:
            covered += 1
    return covered, nbul


def main() -> None:
    print("# Auditoria de extraccion (prompt EXTRACTOR-PROMPT)")
    print()
    for slug, party_key in PARTIES:
        pdf_path = ROOT / "programas" / f"{slug}.pdf"
        json_path = ROOT / "data" / "partidos" / f"{slug}.json"

        pdf_text, pages = read_pdf_text(pdf_path)
        pdf_norm = norm(pdf_text)

        party_data = json.loads(json_path.read_text(encoding="utf-8"))
        propuestas = party_data.get("propuestas", [])
        total = len(propuestas)

        by_cat = {}
        for p in propuestas:
            cat = p.get("categoria", "")
            by_cat[cat] = by_cat.get(cat, 0) + 1

        bullets = extract_bullets(pdf_text)
        citas = [p.get("cita_literal", "") for p in propuestas if p.get("cita_literal")]
        cov, nbul = citation_coverage(bullets, citas)

        print(f"## {party_key} ({slug})")
        print(f"- Paginas PDF: {pages}")
        print(f"- Propuestas JSON: {total} (densidad: {total / pages:.2f} por pagina)")
        print(f"- Bullets detectados en PDF: {nbul}")
        if nbul:
            print(f"- Cobertura bullets por citas JSON: {cov}/{nbul} ({(100 * cov / nbul):.1f}%)")
        else:
            print("- Cobertura bullets por citas JSON: n/a (PDF sin bullets detectables)")

        print("- Alertas de categoria (senales textuales vs JSON):")
        any_alert = False
        for cat, kws in CATEGORY_SIGNALS.items():
            hits = signal_hits(pdf_norm, kws)
            cat_count = by_cat.get(cat, 0)
            # Alert when there are multiple textual signals but no extraction for that category.
            if hits >= 2 and cat_count == 0:
                any_alert = True
                print(f"  - [ALTA] {cat}: 0 propuestas, pero senales en PDF={hits}")
            elif hits >= 3 and cat_count <= 1 and cat in (
                "Sanidad Pública",
                "Educación y Futuro",
                "Sector Primario (Agricultura y Ganadería)",
            ):
                any_alert = True
                print(f"  - [MEDIA] {cat}: {cat_count} propuesta(s), senales en PDF={hits}")
        if not any_alert:
            print("  - Sin alertas claras con esta heuristica")
        print()


if __name__ == "__main__":
    main()
