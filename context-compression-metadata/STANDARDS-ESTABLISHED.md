Documenting these established patterns in a `spec.md` file right at the inception of the Chronoql Horizon codebase is the perfect way to prevent technical debt and ensure UI consistency as the application scales. 

Here is the comprehensive specification document containing all the standards we have engineered. You can drop this directly into the root of your new project.

***

### `spec.md`

```markdown
# Chronoql Horizon: UI/UX & Component Specification

This document outlines the strict UI/UX standards, accessibility requirements, and component architectures for the Chronoql Horizon application. All new modules must adhere to these established patterns to ensure a frictionless, accessible, and highly performant user experience.

---

## 1. Global Accessibility (A11y) Standards

Accessibility is a core architectural requirement, not an afterthought. 

* **Semantic HTML:** Rely on native HTML5 elements (`<button>`, `<dialog>`, `<nav>`, `<main>`) before reaching for `aria-roles` on generic `<div>` tags.
* **Keyboard Navigation:** Every interactive element must be reachable via the `Tab` key.
* **Focus Rings:** Never remove the default focus outline without providing a highly visible alternative. Use the `:focus-visible` pseudo-class to apply a robust focus ring (e.g., `outline: 3px solid var(--accent-color); outline-offset: 2px;`) specifically for keyboard users.
* **Disabled States:** Disabled buttons and inputs must explicitly set the `disabled` HTML attribute and utilize visual cues (`opacity: 0.5`, `cursor: not-allowed`, `filter: grayscale(100%)`) to communicate their state.
* **Aria Labels:** Use `aria-label` or `aria-labelledby` on icon-only buttons or visually hidden structural elements.

---

## 2. High-Contrast Black & White Tooltips

To ensure maximum legibility and WCAG compliance across both Light and Dark modes, tooltips must utilize a strict, high-contrast black-and-white schema governed entirely by CSS.

**Implementation Rules:**
* Requires the `.tooltip-container` wrapper class and a `data-tooltip` attribute containing the text.
* Must break stacking contexts seamlessly using specific `z-index` rules.
* Must trigger on both `:hover` and `:focus-visible` for keyboard accessibility.

**Standard CSS Architecture:**
```css
.tooltip-container {
    position: relative;
    overflow: visible !important; 
}

.tooltip-container:hover,
.tooltip-container:focus-visible {
    z-index: 50;
}

.tooltip-container::after {
    content: attr(data-tooltip);
    position: absolute;
    top: 100%; /* Default drops downward */
    left: 50%;
    transform: translateX(-50%) translateY(6px);
    background-color: #000000 !important;
    color: #ffffff !important;
    border: 2px solid #000000 !important;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: bold;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
    box-shadow: 0 4px 8px rgba(0,0,0,0.4);
    z-index: 1000;
}

.tooltip-container:hover::after,
.tooltip-container:focus-visible::after {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(10px);
}

/* Dark Mode Inversion */
body.dark-mode .tooltip-container::after {
    background-color: #ffffff !important;
    color: #000000 !important;
    border-color: #ffffff !important;
    box-shadow: 0 4px 8px rgba(255,255,255,0.2);
}
```

---

## 3. Geographic Database Lookups (State & Country)

To prevent database fragmentation and ensure standardized naming conventions, geographical inputs (States, Provinces, Countries) must use a **Typeahead Combobox** architecture powered by the local SQLite database.

**Architecture Protocol:**
1.  **The Master Dictionary:** The SQLite database maintains `country` and `state_province` lookup tables.
2.  **Frontend State:** The renderer fetches and caches these dictionaries in memory upon module load to prevent excessive IPC calls during rapid typing.
3.  **The Input Pair:** The UI utilizes a visible `<input type="text">` for user interaction and a `<input type="hidden">` to store the resulting relational Database ID.
4.  **Dropdown Behavior:** * Matches are filtered in real-time as the user types (case-insensitive).
    * Clicking a dropdown option locks the human-readable string into the visible input and sets the hidden input's value to the exact SQLite ID.
    * If the user manually types a value and does not select a dropdown option, the hidden ID is severed (`value=""`), forcing validation handling before saving.

---

## 4. Modern Date & Temporal Inputs

Handling time accurately is vital for Chronoql. All date inputs must provide a native, frictionless experience.

**Input Standards:**
* Use native HTML5 `<input type="date">`. This forces mobile devices to open native date-pickers and provides standard, localized formatting out of the box on desktop browsers.
* Do not use complex third-party JavaScript calendar libraries unless strictly necessary for multi-date range selections.
* **The "Current/Ongoing" Toggle:** Any timeline representing an ongoing event (e.g., current high school enrollment, ongoing extracurricular club) must pair an `End Date` input with an adjacent "Current" checkbox. 

**Checkbox Disabler Logic:**
When the "Current" checkbox is toggled `true`:
1.  The associated `End Date` input must be disabled (`disabled = true`).
2.  The existing value in the `End Date` input must be cleared (`value = ''`).
3.  The database payload must transmit `null` for that specific end date field.

```javascript
// Standard Disabler Pattern
function attachDisablers(checkId, targetId) {
    const cb = document.getElementById(checkId);
    if (!cb) return;
    cb.addEventListener('change', function() { 
        const el = document.getElementById(targetId);
        if(el) {
            el.disabled = this.checked;
            if(this.checked) el.value = '';
        }
    });
}
```
```