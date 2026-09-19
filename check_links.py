#!/usr/bin/env python3
"""Verificateur de liens pour un site statique (stdlib uniquement).

A placer a la racine du depot statbel-app. Parcourt tous les .html du dossier,
extrait href/src, et verifie :
  - liens INTERNES  : la cible (fichier ou dossier/index.html) existe sur le disque
  - liens EXTERNES  : le serveur repond 2xx/3xx  (uniquement avec --external)

Usage :
    python check_links.py              # liens internes seulement
    python check_links.py --external   # internes + externes (plus lent)

Code de sortie != 0 s'il reste au moins un lien casse (utilisable en CI).
"""
from __future__ import annotations

import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

# Attributs porteurs de liens, par balise.
LINK_ATTRS = {
    "a": "href",
    "link": "href",
    "area": "href",
    "img": "src",
    "script": "src",
    "iframe": "src",
    "source": "src",
    "audio": "src",
    "video": "src",
    "track": "src",
    "embed": "src",
}

# Schemas a ignorer (rien a verifier sur le disque ni en HTTP).
SKIP_SCHEMES = ("mailto:", "tel:", "javascript:", "data:", "#")

ROOT = Path(__file__).resolve().parent
TIMEOUT = 10  # secondes pour les requetes externes

# Dossiers a ne pas scanner : dependances / libs vendorisees / interne git.
# (rglob("*.html") y trouverait des pages de doc de paquets -> faux "liens casses")
EXCLUDE_DIRS = {"node_modules", "vendor", ".git"}


def is_excluded(path: Path) -> bool:
    return any(part in EXCLUDE_DIRS for part in path.relative_to(ROOT).parts)


class LinkParser(HTMLParser):
    """Collecte (balise, url) pour chaque attribut de lien rencontre."""

    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_name = LINK_ATTRS.get(tag)
        if not attr_name:
            return
        for name, value in attrs:
            if name == attr_name and value:
                self.links.append(value.strip())


def extract_links(html_file: Path) -> list[str]:
    parser = LinkParser()
    parser.feed(html_file.read_text(encoding="utf-8", errors="replace"))
    return parser.links


def is_external(url: str) -> bool:
    return url.startswith(("http://", "https://", "//"))


def resolve_internal(html_file: Path, url: str) -> Path:
    """Chemin disque cible d'un lien interne (fragment/query retires)."""
    path = unquote(urlsplit(url).path)
    if path.startswith("/"):
        # lien absolu-racine -> relatif a la racine du depot
        target = ROOT / path.lstrip("/")
    else:
        target = (html_file.parent / path).resolve()
    return target


def internal_ok(target: Path) -> bool:
    if target.is_file():
        return True
    # Un dossier est valide s'il contient un index.html.
    if target.is_dir() and (target / "index.html").is_file():
        return True
    return False


def check_external(url: str) -> tuple[bool, str]:
    if url.startswith("//"):
        url = "https:" + url
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "link-check/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return True, str(resp.status)
    except urllib.error.HTTPError as exc:
        # Certains serveurs refusent HEAD (405) -> reessai en GET.
        if exc.code in (403, 405, 501):
            try:
                req_get = urllib.request.Request(url, headers={"User-Agent": "link-check/1.0"})
                with urllib.request.urlopen(req_get, timeout=TIMEOUT) as resp:
                    return True, str(resp.status)
            except Exception as exc2:  # noqa: BLE001
                return False, f"{type(exc2).__name__}"
        return False, f"HTTP {exc.code}"
    except Exception as exc:  # noqa: BLE001 - urlerror, timeout, ssl, dns...
        return False, f"{type(exc).__name__}"


def main() -> int:
    check_ext = "--external" in sys.argv[1:]

    html_files = sorted(f for f in ROOT.rglob("*.html") if not is_excluded(f))
    if not html_files:
        print("Aucun fichier .html trouve a la racine du depot.")
        return 0

    broken_internal: list[str] = []
    broken_external: list[str] = []
    external_seen: dict[str, tuple[bool, str]] = {}  # cache par URL
    n_internal = n_external = 0

    print(f"Analyse de {len(html_files)} fichier(s) HTML sous {ROOT}\n")

    for html_file in html_files:
        rel = html_file.relative_to(ROOT)
        for url in extract_links(html_file):
            if url.startswith(SKIP_SCHEMES):
                continue

            if is_external(url):
                n_external += 1
                if not check_ext:
                    continue
                if url not in external_seen:
                    external_seen[url] = check_external(url)
                ok, info = external_seen[url]
                if not ok:
                    broken_external.append(f"  [{rel}] {url}  ->  {info}")
            else:
                n_internal += 1
                target = resolve_internal(html_file, url)
                if not internal_ok(target):
                    broken_internal.append(f"  [{rel}] {url}")

    # ---- Rapport ----
    print(f"Liens internes verifies : {n_internal}")
    if broken_internal:
        print(f"  CASSES ({len(broken_internal)}) :")
        print("\n".join(broken_internal))
    else:
        print("  OK - aucun lien interne casse.")

    print()
    if check_ext:
        print(f"Liens externes verifies : {len(external_seen)} (uniques sur {n_external} occurrences)")
        if broken_external:
            print(f"  INJOIGNABLES ({len(broken_external)}) :")
            print("\n".join(broken_external))
        else:
            print("  OK - tous les liens externes repondent.")
    else:
        print(f"Liens externes ignores : {n_external}  (relancer avec --external pour les verifier)")

    total_broken = len(broken_internal) + len(broken_external)
    print()
    print("=" * 50)
    print("RESULTAT : OK" if total_broken == 0 else f"RESULTAT : {total_broken} lien(s) casse(s)")
    return 0 if total_broken == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
