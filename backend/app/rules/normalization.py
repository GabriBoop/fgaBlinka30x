import re
import unicodedata
from difflib import SequenceMatcher


def norm_name(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower().replace(".", "")
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s).split())


def norm_num(s):
    return re.sub(r"[\s\-/]", "", s.upper())


def name_similarity(a, b):
    return SequenceMatcher(None, norm_name(a), norm_name(b)).ratio()
