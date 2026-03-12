---
name: BMAD-METHOD
description: The BMad Method for AI-assisted software development operations.
---
# BMad Method Skill

The BMad Method (bmad-method) has been installed in the `_bmad` directory of this project to assist with structured AI-driven software development. 

## Usage Instructions

When the user wants to use BMad or types `/bmad-help`:

1. Read the module help catalogs located at `_bmad/bmm/module-help.csv` and `_bmad/core/module-help.csv`. These catalogs outline all available phases, workflows, commands, and expected outputs.
2. When the user uses a specific BMad command (e.g., `bmad-bmm-quick-spec`, `bmad-bmm-create-prd`), look up the workflow file path in the catalog and read the corresponding `.md` or `.yaml` file. 
3. Execute the workflow exactly as described in the loaded BMad file. Adopt the persona specified by the workflow (e.g., product manager, architect, developer).
4. Save any generated outputs or artifacts to the `_bmad-output` directory or as specified by the workflow.
5. Provide structured, step-by-step guidance to the user in accordance with BMad principles.
