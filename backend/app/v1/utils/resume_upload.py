"""
Resume processing utility functions.

This module contains helper functions for splitting names,
normalizing LLM-extracted data, and extracting skill names.
"""


def split_name(full_name: str | None) -> tuple[str | None, str | None]:
    """Split a full name into first and last name components.

    Args:
        full_name: The complete name string to split.

    Returns:
        A tuple of (first_name, last_name). Returns (None, None) if input is empty.
    """
    if not full_name:
        return "", ""
    parts = full_name.strip().split(maxsplit=1)
    if not parts:
        return "", ""
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""
    return first_name, last_name


def normalize_extractions(
    extracted: object,
) -> dict[str, list[dict[str, object]]]:
    """Normalize raw extraction results into a consistent dictionary format.

    Handles different input types, including objects with direct attributes
    or objects containing a list of extraction records.

    Args:
        extracted: The raw extraction data from the LLM extractor.

    Returns:
        A dictionary containing lists of extractions for fields like
        'name', 'email', 'phone', 'location', 'skills', 'experience', 'education', 'certifications', and 'links'.
    """
    normalized: dict[str, list[dict[str, object]]] = {
        "name": [],
        "email": [],
        "phone": [],
        "location": [],
        "skills": [],
        "experience": [],
        "education": [],
        "certifications": [],
        "links": [],
        "extraordinary_highlights": [],
        "professional_summary": [],
        "experience_summary": [],
    }

    if hasattr(extracted, "skills") and hasattr(extracted, "experience"):
        normalized["skills"] = [
            {"text": skill, "attributes": {}}
            for skill in getattr(extracted, "skills", [])
        ]
        normalized["experience"] = [
            {"text": item, "attributes": {}}
            for item in getattr(extracted, "experience", [])
        ]
        normalized["education"] = [
            {"text": item, "attributes": {}}
            for item in getattr(extracted, "education", [])
        ]
        normalized["certifications"] = [
            {"text": item, "attributes": {}}
            for item in getattr(extracted, "certifications", [])
        ]
        return normalized

    documents = extracted if isinstance(extracted, list) else [extracted]
    for document in documents:
        for extraction in getattr(document, "extractions", []):
            item = {
                "text": getattr(extraction, "extraction_text", ""),
                "attributes": getattr(extraction, "attributes", {}) or {},
            }
            extraction_class = getattr(extraction, "extraction_class", "")
            if extraction_class == "name":
                normalized["name"].append(item)
            elif extraction_class == "email":
                normalized["email"].append(item)
            elif extraction_class == "phone":
                normalized["phone"].append(item)
            elif extraction_class == "location":
                normalized["location"].append(item)
            elif extraction_class in ("skill", "skills"):
                normalized["skills"].append(item)
            elif extraction_class == "experience":
                normalized["experience"].append(item)
            elif extraction_class == "education":
                normalized["education"].append(item)
            elif extraction_class in ("certification", "certifications"):
                normalized["certifications"].append(item)
            elif extraction_class in ("link", "links"):
                text = item.get("text", "")
                # If LLM combined multiple links or tagged as multiple, split them
                if ";" in text or "," in text or item.get("attributes", {}).get("type") == "multiple":
                    # Split by common delimiters
                    delimiters = [";", ","]
                    parts = [text]
                    for d in delimiters:
                        new_parts = []
                        for p in parts:
                            new_parts.extend(p.split(d))
                        parts = new_parts
                    
                    for p in parts:
                        p = p.strip()
                        if p:
                            # Identify type based on URL
                            attr = {}
                            p_lower = p.lower()
                            if "linkedin.com" in p_lower:
                                attr["type"] = "linkedin"
                            elif "github.com" in p_lower:
                                attr["type"] = "github"
                            elif "behance.net" in p_lower or "dribbble.com" in p_lower:
                                attr["type"] = "portfolio"
                            else:
                                attr["type"] = "website"
                            
                            normalized["links"].append({
                                "text": p,
                                "attributes": attr
                            })
                else:
                    # Single link, still try to improve type if generic
                    if not item.get("attributes", {}).get("type") or item["attributes"]["type"] == "multiple":
                        p_lower = text.lower()
                        if "linkedin.com" in p_lower:
                            item["attributes"]["type"] = "linkedin"
                        elif "github.com" in p_lower:
                            item["attributes"]["type"] = "github"
                    normalized["links"].append(item)

    return normalized


def extract_skill_names(
    normalized: dict[str, list[dict[str, object]]],
) -> list[str]:
    """Extract and deduplicate unique skill names from normalized extractions.

    Splits comma- or semicolon-separated skill strings and normalizes them for deduplication.

    Args:
        normalized: The dictionary of normalized extractions.

    Returns:
        A list of unique, non-empty skill names.
    """
    skill_names: list[str] = []
    seen: set[str] = set()

    def is_missing(val):
        if not val: return True
        if isinstance(val, str) and val.strip().lower() in ("not mentioned", "null", "none", "unknown", "n/a"): return True
        return False

    for item in normalized["skills"]:
        text = str(item["text"]).strip()
        if is_missing(text):
            continue

        parts = [text]
        for delimiter in (",", ";"):
            new_parts = []
            for part in parts:
                new_parts.extend(part.split(delimiter))
            parts = new_parts

        for part in (piece.strip() for piece in parts):
            key = part.lower()
            if part and not is_missing(part) and key not in seen:
                seen.add(key)
                skill_names.append(part)
    return skill_names
