# Skills - Dubletter & Överlappningar

Analyserad: 2026-08-20

## Ej dubletter — varje skill har unikt värde

Inga exakta dubletter hittades. Alla 87 skills har en unik roll.

---

## Grupper med semantiska överlappningar

### 1. Vision / Bildanalys (3 skills)
| Skill | Vad den gör | Använd när... |
|-------|-------------|---------------|
| **vision-analysis** | Routning: Qwen3-VL 8B (fast) eller 30B (djup) för lokala bilder/skärmdumpar. Inkl. hjälparscript. | Du behöver bildd Analys med Qwen3-VL, oavsett provider. |
| **dqhermes-vision** | Beskriver dqhermes-provider: 2 vision-modeller (8B/30B) på localhost:9292. Används för att switcha model/provider. | Du vill använda vision-modeller via dqhermes-provideren. |
| **image-enhancer** | Förbättrar bildkvalitet: upscaler, skärpa, rensa artefakter. | Du vill **förbättra** en bild, inte analysera den. |

**Överlappning:** `vision-analysis` och `dqhermes-vision` täcker samma modeller (Qwen3-VL 8B/30B). `vision-analysis` är en **routing-skill** (väljer rätt tool/modell), `dqhermes-vision` är en **provider-beskrivning** (hur du använder vision-modeller via dqhermes).

**Rekommendation:** Håll båda. `vision-analysis` är den generiska routern. `dqhermes-vision` är specifikt för dqhermes. De kompletterar varandra.

---

### 2. Web Content Extraction (2 skills)
| Skill | Vad den gör | Använd när... |
|-------|-------------|---------------|
| **defuddle** | Extraherar clean markdown från webbsidor via Defuddle CLI. Fokuserar på att ta bort clutter. | Du vill läsa en webbsida i clean markdown (lådor, nav, ads borta). |
| **content-research-writer** | Writing partner: research, citations, hooks, outlines, section feedback. | Du skriver en artikel/bloggpost och vill ha hjälp med research + struktur. |

**Överlappning:** Ingen direkt. `defuddle` är ett verktyg, `content-research-writer` är en skrivprocess.

**Rekommendation:** Håll båda. De gör helt olika saker.

---

### 3. Code Review (2 skills)
| Skill | Vad den gör | Använd när... |
|-------|-------------|---------------|
| **github-code-review** | Granskar PRs på GitHub: inline comments, approve/request changes via gh eller REST. | Du granskar **andras PRs** på GitHub. |
| **requesting-code-review** | Pre-commit verifiering: security scan, baseline tests, lint, oberoende reviewer-subagent, auto-fix. | Du vill granska **dina egna ändringar** innan commit. |

**Överlappning:** Båda handlar om code review men **olika scener**. `requesting-code-review` är "granska MITT arbete innan jag pushar". `github-code-review` är "granska NÅGON ANNANS PR".

**Rekommendation:** Håll båda. De kompletterar varandra perfekt. Skillen beskriver detta explicit.

---

### 4. Playwright (3 skills)
| Skill | Vad den gör | Använd när... |
|-------|-------------|---------------|
| **playwright-skill** | Master-skill: 50+ guider, täcker allt (E2E, CI/CD, migration). Referens-skill. | Du behöver Playwright-guidning generellt. |
| **playwright-core** | Battle-tested patterns: locators, assertions, fixtures, network mocking. Fokus på test-patterns. | Du behöver specifika test-mönster och debugging. |
| **playwright-cli** | Terminal-first browser control: click, fill, screenshot, tracing via CLI. | Du vill styra browser från terminalen utan att skriva testkod. |

**Överlappning:** `playwright-skill` är en **index/referens-skill** som pekar på alla andra. `playwright-core` och `playwright-cli` är **specifika** guider. `playwright-skill` länkar till båda.

**Rekommendation:** `playwright-skill` och `playwright-core` har ~80% samma innehåll (samma golden rules, samma guid-index). `playwright-core` är en **klon** av `playwright-skill` med något annan struktur.

**Rekommendation:** `playwright-cli` är unik — behåll. `playwright-core` och `playwright-skill` är **dubletter** — behåll bara `playwright-skill` (den är mer comprehensive). `playwright-core` kan tas bort.

---

### 5. Obsidian (4 skills)
| Skill | Vad den gör | Använd när... |
|-------|-------------|---------------|
| **obsidian** | File-system-first: read, list, search, create, append notes i Obsidian-vault. | Du vill hantera vault-filer med file-tools (read_file, write_file). |
| **obsidian-cli** | Interagera med OBSIDIAN APP via CLI: read, create, search, plugin dev, DOM inspektion. | Obsidian är öppet och du vill använda dess CLI (kräver app). |
| **obsidian-markdown** | Obsidian Flavored Markdown syntax: wikilinks, callouts, properties, embeds. | Du skriver Obsidian-notation (.md filer). |
| **obsidian-bases** | Obsidian Bases (.base): filters, views, formulas, table/card views. | Du skapar Bases-filer. |

**Överlappning:** `obsidian` och `obsidian-cli` är den största överlappningen. `obsidian` är **filesystem** (ingen app behövs), `obsidian-cli` kräver **öppen Obsidian-app**.

**Rekommendation:** Håll alla 4. De är **komplementära**, inte dubletter:
- `obsidian` = file-system (alltid tillgänglig)
- `obsidian-cli` = app-interaktion (plugin dev, DOM)
- `obsidian-markdown` = syntax-guide (skriva .md filer)
- `obsidian-bases` = Bases-format (specifik filtyp)

---

### 6. Dokumentbearbetning (4 skills)
| Skill | Vad den gör | Använd när... |
|-------|-------------|---------------|
| **pdf** | PDF manipulation: merge, split, extract, create, watermarks, forms. | Du gör strukturella ändringar på PDFs. |
| **nano-pdf** | Editera TEXT i befintliga PDFs via natural language. | Du vill ändra text i en PDF (t.ex. datum, namn). |
| **ocr-and-documents** | Text-extraktion från PDFs/scans: pymupdf + marker-pdf. | Du vill extrahera text (särskilt OCR/scanned docs). |
| **docx** | DOCX: create, edit, tracked changes, comments, raw XML. | Du arbetar med Word-dokument. |
| **pptx** | PPTX: create, edit, presentations. | Du arbetar med PowerPoint. |
| **xlsx** | XLSX: formulas, formatting, data analysis, visualization. | Du arbetar med Excel. |

**Överlappning:** `pdf`, `nano-pdf`, och `ocr-and-documents` är alla PDF-relaterade men **olika layer**:
- `pdf` = strukturell (merge/split/forms/creation)
- `nano-pdf` = text-edit via AI (naturligt språk)
- `ocr-and-documents` = text-extraction (OCR)

**Rekommendation:** Håll alla 3 PDF-skills. De täcker olika användningsområden. Skillen för `nano-pdf` hänvisar explicit till de andra två för kompletterande uppgifter.

---

### 7. Frontend Design (3 skills)
| Skill | Vad den gör | Använd när... |
|-------|-------------|---------------|
| **image-to-code** | Bild-först: generera design-image(s), analysera dem, implementera frontend. | Du vill designa + kodja en sida från bildreferenser. |
| **design-taste-frontend** | Anti-slop frontend: landing pages, portfolios, redesigns. Läser briefen, infererar design. | Du designar en landningssida/portfolio/redesign. |
| **high-end-visual-design** | $150k agency-design: dubbel-bezel-kort, motion-choreografi, custom easing. | Du vill ha extremt premium, agency-kvalitet UI. |

**Överlappning:** Alla tre handlar om **frontend-design**, men med olika fokus:
- `image-to-code` = **image-first workflow** (generera bild → analysera → kodja)
- `design-taste-frontend` = **anti-slop** (lägger ton/vibe/system)
- `high-end-visual-design` = **premium detaljer** (dubbel-bezel, motion, easing)

**Rekommendation:** `image-to-code` och `design-taste-frontend` har **betydande överlappning** — båda handlar om att designa och kodja webbplatser. `image-to-code` är mer preskriptiv (måste generera bild först), `design-taste-frontend` är mer flexibel (läser briefen först).

**Rekommendation:** `image-to-code` är ~38 sektioner och extremt lång. `design-taste-frontend` är mer koncis och praktisk. Behåll `design-taste-frontend` och `high-end-visual-design` (de kompletterar varandra). `image-to-code` kan tas bort eller fusioneras.

---

## Sammanfattning

### Dubletter att överväga att ta bort:
1. ~~`playwright-core`~~ — **Behåll!** Den är en sub-skill under `playwright-skill` (guide-index), inte en separat skill. Ingen åtgärd behövs här.
2. ~~`image-to-code`~~ — **BORTTAGEN** 2026-08-20. ~38 sektioner (36KB), tung, överlapp med `design-taste-frontend` + `high-end-visual-design`.

### Komplementära skills (håll alla):
- Vision: `vision-analysis`, `dqhermes-vision`, `image-enhancer` — olika lager
- Code review: `github-code-review`, `requesting-code-review` — olika scener
- Obsidian: `obsidian`, `obsidian-cli`, `obsidian-markdown`, `obsidian-bases` — olika användningsområden
- PDF: `pdf`, `nano-pdf`, `ocr-and-documents` — olika layer
- Design: `design-taste-frontend`, `high-end-visual-design` — komplementära
