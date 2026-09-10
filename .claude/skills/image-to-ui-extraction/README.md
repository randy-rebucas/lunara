# Image-to-UI Extraction Skill

This skill teaches Claude to reverse-engineer UI screenshots into:
- extracted/reference assets
- annotated references
- design tokens
- reusable components
- responsive rules
- interaction states
- implementation specifications

## Install

Copy the `image-to-ui-extraction` directory into the skills directory used by your Claude environment.

The skill entry point is:

`image-to-ui-extraction/SKILL.md`

## Typical prompt

"Use the image-to-ui-extraction skill on this screenshot. Extract meaningful assets, annotate the screen, identify reusable components, and produce a React Native implementation specification. Do not rasterize normal UI."

## Important

The skill deliberately distinguishes reference crops from production assets. It does not encourage building an application out of screenshot fragments.
