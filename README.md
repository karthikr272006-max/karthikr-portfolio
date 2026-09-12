# Karthik R — Portfolio

A static personal portfolio built with HTML, CSS and vanilla JavaScript. The site presents projects, experience, speaking interests and contact details.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Page content, navigation, project sections and contact form |
| `style.css` | Layout, theme, responsive styles and visual effects |
| `script.js` | Canvas animation, typing, navigation, reveals and form interactions |

There is no package-install or compilation step for this site. It does not include a contact-message backend.

## Preview locally

Clone the repository and serve it with Python 3:

```bash
git clone https://github.com/karthikr272006-max/karthikr-portfolio.git
cd karthikr-portfolio
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). On Windows, `py -m http.server 8000 --bind 127.0.0.1` is an alternative if the Python launcher is installed. Stop the server with Ctrl+C.

Google Fonts is loaded remotely; local preview can use fallback fonts when offline.

## Update the content

- Edit profile text, projects and contact links in `index.html`.
- Edit the rotating role labels in the `roles` array in `script.js`.
- Adjust visual styling in `style.css`.
- Keep displayed achievements and experience aligned with verified information.

## Checks before publishing

Run the offline HTML smoke tests from the repository root with Python 3 (no extra packages required):

```bash
python3 -m unittest discover -s tests -v
```

On Windows, use `py -m unittest discover -s tests -v` if the Python launcher is installed.

These checks catch duplicate or empty IDs, missing same-page navigation targets, missing local scripts/stylesheets, broken label/ARIA references, and project detail controls whose targets or initial visibility are inconsistent. They parse `index.html`; they do not execute JavaScript, fetch external resources, or verify message delivery.

If Node.js is installed, check JavaScript syntax:

```bash
node --check script.js
```

A syntax check does not catch every runtime error. Also preview the page and check:

1. Browser console errors after the first animation frame.
2. Mobile navigation opening and closing.
3. Project details expanding and collapsing.
4. Keyboard navigation and reduced-motion behavior.
5. Valid and invalid contact-form input, including what happens to the entered message.

## Known behavior to address

These findings were confirmed against the repository source on 11 September 2026:

- **Canvas animation:** `step()` reads `a` outside the inner loop where it is declared. This produces `ReferenceError: a is not defined` when the animated background runs. Define the current node in the outer-loop scope before using it for cursor connections.
- **Contact form:** submitting valid input prevents the normal form submission, displays a notification and resets the form. It does not send or persist a message. Use the displayed email link to contact Karthik until a real submission flow is implemented.
- **Résumé button:** currently shows an email-on-request notice; it does not open a résumé file.

The two JavaScript defects above were reproduced with isolated local checks. Those checks are not a substitute for a full browser review.

## Maintenance

Keep updates focused and validate their behavior. Automated contributions should describe the actual change and the checks performed. Remove a known-issue note only after the underlying behavior has been corrected and verified.
