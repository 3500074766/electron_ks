Goal: make the top functionality area taller without breaking layout.

Changes:
- In `src/renderer/src/components/HeaderActions.vue`, set ElCard `body-style` padding to increase vertical space (e.g., 24px).
- Keep existing content and styles; no fixed pixel heights to preserve responsiveness.

Verification:
- Header visually taller; table area remains responsive.
- No layout overflow or horizontal scroll introduced.