import re
file_path = r'c:\OneDriveTemp\Desktop\New folder (8)\backend\app\v1\utils\transcript_parser.py'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("r'\\\\", "r'\\").replace('r"\\\\', 'r"\\')
text = text.replace("r'!", "r'!") 
# Actually just a literal replace
text = text.replace(r"\\", r"\ ")
text = text.replace(r"\ ", r"\")

# Replace all occurrences of 2 backslashes with 1 backslash IF they're inside an re. method:
lines = text.split('\n')
new_lines = []
for line in lines:
    if 're.' in line and 'text = text' not in line: # avoid my replacements
        line = line.replace('\\\\', '\\')
    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))
print("Fixed!")
