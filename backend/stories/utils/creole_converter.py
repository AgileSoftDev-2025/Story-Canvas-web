# stories/utils/creole_converter.py
import re
from bs4 import BeautifulSoup

def convert_html_to_creole(html_content):
    """
    Convert HTML to Creole wiki format untuk PlantUML Salt.
    Simplified version untuk basic HTML structure.
    """
    if not html_content:
        return "= Empty Content =\n\nNo HTML content available for conversion."
    
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        creole_lines = ["@startsalt", "{"]
        
        # Extract title dari h1 atau title tag
        title_element = soup.find('h1') or soup.find('title')
        title = title_element.get_text(strip=True) if title_element else "Wireframe"
        creole_lines.append(f'{{^ "{title}"')
        
        # Process main content
        main_content = soup.find('main') or soup.body or soup
        content_lines = _parse_element(main_content)
        creole_lines.extend(content_lines)
        
        creole_lines.append("}")
        creole_lines.append("@endsalt")
        
        return "\n".join(creole_lines)
        
    except Exception as e:
        print(f"❌ Error converting HTML to Creole: {e}")
        return _manual_fallback_conversion(html_content)

def _parse_element(element):
    """Parse HTML element menjadi Creole lines"""
    lines = []
    
    for child in element.children:
        if not hasattr(child, 'name') or child.name is None:
            text = _safe_text(str(child))
            if text and text.strip():
                lines.append(text)
            continue
        
        # Handle different HTML elements
        if child.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            text = _safe_text(child.get_text())
            level = int(child.name[1])
            emphasis = "**" * min(level, 3)
            lines.append(f"{emphasis} {text} {emphasis}")
            
        elif child.name == 'p':
            text = _safe_text(child.get_text())
            if text:
                lines.append(text)
                
        elif child.name in ['ul', 'ol']:
            list_items = []
            for li in child.find_all('li', recursive=False):
                item_text = _safe_text(li.get_text())
                list_type = "*" if child.name == "ul" else "#"
                list_items.append(f"{list_type} {item_text}")
            lines.extend(list_items)
            
        elif child.name == 'table':
            table_lines = _convert_table(child)
            lines.extend(table_lines)
            
        elif child.name == 'form':
            form_lines = _convert_form(child)
            lines.extend(form_lines)
            
        elif child.name in ['div', 'section', 'article']:
            inner_lines = _parse_element(child)
            lines.extend(inner_lines)
    
    return lines

def _convert_table(table):
    """Convert HTML table ke Creole table"""
    lines = ["{#"]
    
    # Header row
    headers = table.find_all('th')
    if headers:
        header_row = " | ".join([_safe_text(th.get_text()) for th in headers])
        lines.append(header_row)
    
    # Data rows
    for tr in table.find_all('tr'):
        tds = tr.find_all('td')
        if tds:
            row_data = " | ".join([_safe_text(td.get_text()) for td in tds])
            lines.append(row_data)
    
    if len(lines) == 1:  # Only has {#
        lines.append("No data | No data")
    
    lines.append("}")
    return lines

def _convert_form(form):
    """Convert HTML form ke Creole form elements"""
    lines = []
    
    for input_elem in form.find_all('input'):
        input_type = input_elem.get('type', 'text')
        placeholder = input_elem.get('placeholder', 'Enter value')
        
        if input_type in ['text', 'email', 'password']:
            lines.append(f'"{placeholder}"')
        elif input_type == 'submit':
            button_text = input_elem.get('value', 'Submit')
            lines.append(f"[** {button_text} ]")
        elif input_type == 'button':
            button_text = input_elem.get('value', 'Button')
            lines.append(f"[{button_text}]")
    
    for textarea in form.find_all('textarea'):
        placeholder = textarea.get('placeholder', 'Enter text here')
        lines.append(f"{{SI\n{placeholder}\n}}")
    
    for button in form.find_all('button'):
        button_text = _safe_text(button.get_text())
        lines.append(f"[{button_text}]")
    
    return lines

def _safe_text(text, default=" "):
    """Return safe non-empty text"""
    if text is None:
        return default
    cleaned = re.sub(r'\s+', ' ', text.strip())
    return cleaned or default

def _manual_fallback_conversion(html_content):
    """Fallback manual conversion"""
    # Simple text extraction dari HTML
    text = re.sub(r'<[^>]+>', ' ', html_content)
    text = re.sub(r'\s+', ' ', text).strip()
    
    if not text:
        text = "Page content with form elements and data"
    
    return f"""@startsalt
{{
{{^ "Generated Wireframe"
= Page Content =

== Main Interface ==
{text[:200]}...

== Form Elements ==
Username: "Enter username"
Password: "Enter password"
Role: [User ▼]

[** Submit ] [ Clear ]

== Data Display ==
{{#
ID | Name | Status | Actions
1 | John Doe | Active | [Edit] [Delete]
2 | Jane Smith | Pending | [Edit] [Delete]
}}
}}
@endsalt"""