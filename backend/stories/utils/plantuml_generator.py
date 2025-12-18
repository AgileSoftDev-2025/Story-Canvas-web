"""
PlantUML PNG Generator Utility
Use this in your existing Django views
"""

import base64
import string
import zlib
from typing import Dict, Any

# PlantUML Alphabet
PLANTUML_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"

def generate_plantuml_png_url(salt_code: str) -> str:
    """
    Generate PlantUML PNG URL from Salt UML code
    Use this function in your existing wireframe generation endpoints
    
    Args:
        salt_code: Complete PlantUML Salt code (@startuml...@enduml)
    
    Returns:
        PlantUML PNG URL
    """
    try:
        # Ensure proper syntax
        if not salt_code.strip().startswith('@startuml'):
            salt_code = f"@startuml\n{salt_code}"
        if not salt_code.strip().endswith('@enduml'):
            salt_code = f"{salt_code}\n@enduml"
        
        encoded = _plantuml_encode(salt_code)
        if not encoded:
            raise ValueError("Failed to encode PlantUML")
        
        return f"https://www.plantuml.com/plantuml/png/{encoded}"
        
    except Exception as e:
        print(f"❌ Error generating PlantUML URL: {e}")
        return ""

def _plantuml_encode(text: str) -> str:
    """
    Encode PlantUML text into PlantUML server format
    """
    try:
        zlibbed_str = zlib.compress(text.encode("utf-8"))
        # strip zlib header (2 bytes) and checksum (last 4 bytes)
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

def create_salt_diagram_from_creole(creole_content: str, page_title: str) -> str:
    """
    Create complete Salt UML diagram from Creole content
    Use this when generating wireframes
    
    Args:
        creole_content: Creole wiki format content
        page_title: Title for the diagram
    
    Returns:
        Complete PlantUML Salt code
    """
    return f"""@startuml
@startsalt
{{^ "{page_title}"
{creole_content}
}}
@endsalt
@enduml"""

def generate_wireframe_with_diagram(html_content: str, page_name: str) -> Dict[str, Any]:
    """
    Complete wireframe generation with PNG URL
    Use this in your existing wireframe generation endpoints
    
    Args:
        html_content: HTML wireframe content
        page_name: Page name/title
    
    Returns:
        Dictionary with wireframe data and PNG URL
    """
    try:
        # Import your existing convert_html_to_creole function
        from .salt_generator import convert_html_to_creole
        
        # 1. Convert HTML to Creole
        creole_content = convert_html_to_creole(html_content)
        
        # 2. Create Salt diagram
        salt_diagram = create_salt_diagram_from_creole(creole_content, page_name)
        
        # 3. Generate PNG URL
        png_url = generate_plantuml_png_url(salt_diagram)
        
        return {
            'success': True,
            'page_name': page_name,
            'html_content': html_content,
            'creole_content': creole_content,
            'salt_diagram': salt_diagram,
            'png_url': png_url,
            'html_length': len(html_content),
            'creole_length': len(creole_content),
            'salt_length': len(salt_diagram)
        }
        
    except Exception as e:
        print(f"❌ Error generating wireframe diagram: {e}")
        return {
            'success': False,
            'page_name': page_name,
            'error': str(e),
            'html_content': html_content,
            'png_url': ''
        }