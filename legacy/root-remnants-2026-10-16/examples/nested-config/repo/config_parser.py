"""A deliberately faulty fixture for Aurora's integration demo."""


def coerce_values(value):
    """Convert string booleans and integers in a configuration tree."""
    if isinstance(value, dict):
        return {key: coerce_values(item) for key, item in value.items()}
    if isinstance(value, list):
        return value  # BUG: list contents are not visited
    if isinstance(value, str):
        lowered = value.lower()
        if lowered in {"true", "false"}:
            return lowered == "true"
        try:
            return int(value)
        except ValueError:
            return value
    return value
