import os

project_dir = "/Users/drefan/Projects/Printing System"
out_file = os.path.join(project_dir, "ALL_DOCS_COMBINED.md")

with open(out_file, "w") as outfile:
    for root, dirs, files in os.walk(project_dir):
        # Exclude hidden directories like .git and .claude
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for file in sorted(files):
            if file.endswith(".md") and file != "ALL_DOCS_COMBINED.md":
                path = os.path.join(root, file)
                outfile.write(f"\n\n{'='*50}\n")
                outfile.write(f"FILE: {os.path.relpath(path, project_dir)}\n")
                outfile.write(f"{'='*50}\n\n")
                try:
                    with open(path, "r") as infile:
                        outfile.write(infile.read())
                except Exception as e:
                    outfile.write(f"Error reading file: {e}")

print("Done combining.")
