import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap");

:root {
  --color-bg: #0b1b2a;
  --color-surface: #10273a;
  --color-card: #f5f8fb;
  --color-text: #e9f0f7;
  --color-muted: #98aec4;
  --color-accent: #27c6b3;
  --color-accent-strong: #19a293;
  --color-border: #21415a;
  --color-text-accent: #ffba2b;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 2.5rem;
  --space-8: 3rem;

  --radius-1: 6px;
  --radius-2: 10px;
  --radius-3: 16px;

  --shadow-1: 0 12px 30px rgba(3, 15, 26, 0.35);
  --shadow-2: 0 10px 24px rgba(7, 21, 35, 0.25);

  --header-height: 160px;
}

@media (max-width: 768px) {
  :root {
    --header-height: 120px;
  }
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  display: inline-block;
  font-family: "Space Grotesk", "Plus Jakarta Sans", sans-serif;
  letter-spacing: -0.02em;
}

body {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  font-family: "Plus Jakarta Sans", sans-serif;
  background:
    radial-gradient(900px 520px at 10% -10%, rgba(39, 198, 179, 0.2) 0%, transparent 60%),
    radial-gradient(700px 480px at 90% 10%, rgba(41, 91, 138, 0.35) 0%, transparent 65%),
    linear-gradient(180deg, #071523 0%, var(--color-bg) 100%);
  color: var(--color-text);
}

button,
input,
select,
textarea {
  font-family: "Plus Jakarta Sans", sans-serif;
}

input[type="number"] {
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

a {
  color: inherit;
}

img {
  max-width: 100%;
  height: auto;
}

#root {
  min-height: 100dvh;
}
`;

export default GlobalStyle;
