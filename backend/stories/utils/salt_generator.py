# stories/utils/salt_generator.py
import re

def generate_salt_wireframe(creole_content, page_title):
    """
    Wraps Creole content inside a PlantUML Salt wireframe block.
    """
    salt_code = f"""@startsalt
{{
+== {page_title} ==
{creole_content}
}}
@endsalt"""
    return salt_code

def wrap_salt_block(title, creole_body):
    """Wrap Creole body dalam complete Salt UML block"""
    return f"""@startuml
@startsalt
{{^ "{title}"
{creole_body}
}}
@endsalt
@enduml"""

# PlantUML encoding functions
import zlib
import base64

PLANTUML_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"

def plantuml_encode(text):
    """
    Encode PlantUML text into the format expected by the PlantUML server.
    Uses zlib + custom base64 mapping.
    """
    try:
        zlibbed_str = zlib.compress(text.encode("utf-8"))
        compressed_str = zlibbed_str[2:-4]

        def encode3bytes(b1, b2, b3):
            c1 = b1 >> 2
            c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
            c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
            c4 = b3 & 0x3F
            return (PLANTUML_ALPHABET[c1] + PLANTUML_ALPHABET[c2] +
                    PLANTUML_ALPHABET[c3] + PLANTUML_ALPHABET[c4])

        res = ""
        i = 0
        length = len(compressed_str)
        while i < length:
            b1 = compressed_str[i]
            b2 = compressed_str[i+1] if i+1 < length else 0
            b3 = compressed_str[i+2] if i+2 < length else 0
            res += encode3bytes(b1, b2, b3)
            i += 3
        return res
    except Exception as e:
        print(f"❌ PlantUML encoding error: {e}")
        return ""

def plantuml_url(plantuml_code):
    """Generate PlantUML server URL untuk diagram"""
    encoded = plantuml_encode(plantuml_code)
    return f"http://www.plantuml.com/plantuml/png/{encoded}"

def render_plantuml_png(salt_code, output_file=None):
    """Render PlantUML SALT code ke PNG"""
    try:
        url = plantuml_url(salt_code)
        
        if output_file:
            import requests
            response = requests.get(url)
            if response.status_code == 200:
                import os
                os.makedirs(os.path.dirname(output_file), exist_ok=True)
                with open(output_file, "wb") as f:
                    f.write(response.content)
                return output_file
            else:
                raise RuntimeError(f"Failed to render PlantUML. Status: {response.status_code}")

        return url
    except Exception as e:
        print(f"❌ Error in render_plantuml_png: {e}")
        if output_file:
            # Create placeholder file
            import os
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            with open(output_file, "w") as f:
                f.write("PNG generation failed")
        return ""