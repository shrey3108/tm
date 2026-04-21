import sys

file_path = r'c:\OneDriveTemp\Desktop\New folder (8)\backend\app\v1\utils\transcript_parser.py'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(r\"r'!\\[.*?\\]\\(data:image/[^)]*\\)'\", r\"r'!\[.*?\]\(data:image/[^)]*\)'\")
text = text.replace(r\"r'!\\[.*?\\]\\(.*?\\)'\", r\"r'!\[.*?\]\(.*?\)'\")
text = text.replace(r\"r'\\*\\*(.+?)\\*\\*'\", r\"r'\*\*(.+?)\*\*'\")
text = text.replace(r\"r'\\*(.+?)\\*'\", r\"r'\*(.+?)\*'\")
text = text.replace(r\"r'\\1'\", r\"r'\1'\")
text = text.replace(r\"r'^#{1,6}\\s+'\", r\"r'^#{1,6}\s+'\")
text = text.replace(r\"r'^[,.\\s]+'\", r\"r'^[,.\s]+'\")
text = text.replace(r\"r'^\\s*[.,\\s]+\\s*$'\", r\"r'^\s*[.,\s]+\s*$'\")
text = text.replace(r\"r'[ \\t]+'\", r\"r'[ \t]+'\")
text = text.replace(r\"r'\\.{2,}'\", r\"r'\.{2,}'\")
text = text.replace(r\"r'\\?{2,}'\", r\"r'\?{2,}'\")
text = text.replace(r\"r'!{2,}'\", r\"r'!{2,}'\")
text = text.replace(r\"r'\\n{3,}'\", r\"r'\n{3,}'\")
text = text.replace(r\"rf'\\b{re.escape(phrase)}\\b'\", r\"rf'\b{re.escape(phrase)}\b'\")
text = text.replace(r\"rf'\\b{re.escape(word)}\\b'\", r\"rf'\b{re.escape(word)}\b'\")

# Also the extract_dialogues one:
text = text.replace(r\"r'^(.+?)\\s+(\\d{1,2}:\\d{2}(?::\\d{2})?)\\s*$'\", r\"r'^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$'\")
text = text.replace(r\"r'^[.,\\s]+$'\", r\"r'^[.,\s]+$'\")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated transcript_parser.py successfully.')
