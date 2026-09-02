// `tsc --noEmit` (docs/agents/AGENT_DEVOPS.md, CI) no resol imports d'efecte lateral de
// CSS global (`import './globals.css'`, `src/app/layout.tsx`): Next.js els gestiona amb
// el seu propi loader de webpack en `next build`, no via el sistema de mòduls de
// TypeScript. Sense aquesta declaració ambient, `tsc` (però no `next build`) els rebutja.
declare module '*.css';
