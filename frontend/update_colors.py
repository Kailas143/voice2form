import re

with open("src/styles.css", "r") as f:
    content = f.read()

# Update CSS variables in :root
root_replacements = {
    r"--bg: #[0-9a-fA-F]+;": "--bg: #FFFFFF;",
    r"--text: #[0-9a-fA-F]+;": "--text: #0F172A;",
    r"--accent: #[0-9a-fA-F]+;": "--accent: #1E3A8A;",
    r"--accent-strong: #[0-9a-fA-F]+;": "--accent-strong: #172554;",
    r"--bg-gradient-1: #[0-9a-fA-F]+;": "--bg-gradient-1: #F8FAFC;",
}

for pattern, repl in root_replacements.items():
    # Only replace first occurrence (which is in :root)
    content = re.sub(pattern, repl, content, count=1)

# Update hardcoded teal (rgba(15, 118, 110, ...)) to Forest Green (22, 101, 52)
content = content.replace("15, 118, 110", "22, 101, 52")

# Update hardcoded dark teal (rgba(17, 94, 89, ...)) to darker Forest Green (15, 75, 38)
content = content.replace("17, 94, 89", "15, 75, 38")

# Update hardcoded warm blue (#0ea5e9) to Emerald (#22C55E)
content = content.replace("#0ea5e9", "#22C55E")
content = content.replace("14, 165, 233", "34, 197, 94") # rgb for 0ea5e9 -> rgb for 22c55e

# Write back
with open("src/styles.css", "w") as f:
    f.write(content)

print("Colors updated successfully.")
