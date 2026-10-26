---
title: Homepage Rules
description: Rules for the editable Suhtleja homepage block and media slots
tags: [suhtleja, homepage, payload, media]
---

# Homepage

## Scope

- Block config: `src/blocks/SuhtlejaHomepage/config.ts`
- Block component: `src/blocks/SuhtlejaHomepage/Component.tsx` (hero, video, features), with the other sections in `src/blocks/SuhtlejaHomepage/sections/`
- Fallback copy: `src/blocks/SuhtlejaHomepage/defaults.ts`
- Homepage-only UI (buttons, media frame): `src/blocks/SuhtlejaHomepage/ui.tsx`; shared brand pieces (`toneAt`, `LogoTile`, `SectionIntro`): `src/components/Brand` (see `docs/rules/project/ui-components.md`)
- Speech for the "Kuula ise" tiles: `src/app/(frontend)/next/homepage-tts/[hash]/route.ts`, `src/utilities/homepageSpeech.ts`
- Header trial button: `src/Header/Component.client.tsx`
- Page registration: `src/collections/Pages/index.ts`
- Renderer registration: `src/blocks/RenderBlocks.tsx`

## Section order

The homepage answers a parent's questions in the order they ask them. Each section is a group in the block with an `enabled` toggle, rendered in this order:

1. `hero`: headline, buttons, trial note (`note`), short highlights and up to three floating labels (`badges`) around the product image.
2. `video` (`#video`): uploaded video or embed in a dialog.
3. `audience` "Kellele" (`#kellele`): three cards for parents, kindergartens and schools, and therapists.
4. `listen` "Kuula ise" (`#kuula`): tiles that speak their word in Estonian when tapped.
5. `steps` "Kuidas alustada" (`#alusta`): numbered steps from sign-up to handing the device to the child.
6. `features` "Võimalused" (`#voimalused`): one tab per feature item.
7. `about` "Miks Suhtleja" (`#miks`): reasons to trust Suhtleja, a link to `/meist`, and quotes when editors add them.
8. `pricing` "Hind" (`#hind`): one plan card and a contact line for institutions.
9. `faq` "KKK" (`#kkk`): questions and answers in an accordion.
10. `closing`: an orange band with the sign-up button.

Header nav items are content in the Header global; link new sections with anchors such as `/#hind` and `/#kkk`.

## Rules

- The homepage content should stay editable in Payload through the `suhtlejaHomepage` block.
- Each main section should have an `enabled` toggle so editors can hide it without deleting content.
- Empty text fields and empty lists in `hero.note`, `hero.badges`, `audience.eyebrow`, `audience.cards` and every field of `listen`, `steps`, `about`, `pricing`, `faq` and `closing` render the copy in `defaults.ts`. Sections added after the homepage was first saved have no stored content, so the live page shows these defaults until an editor fills the fields. The admin shows the default text as each field's placeholder.
- Keep fallback copy factual. Trial length comes from `MEMBERSHIP_TRIAL_DAYS`; claims about the product (PIN lock, Estonian speech, browser use) must match how it works. "Kaarti pole vaja" is true only for first-time subscribers, and the FAQ says so.
- `about.testimonials` and `hero.highlights` have no fallback. Quotes are shown only when an editor adds real ones; highlights only when an editor adds them, because the floating labels already carry the short selling points.
- The hero image uses `object-contain` so device mockups are never cropped; other media frames use `object-cover`. The hero should show a real product screenshot with correct Estonian, not a generated mockup. With an uploaded image the frame is 4:3 below `lg` so phones don't show empty space around the device.
- Hero floating labels sit on the image edges on `lg` screens and as a row under the image on smaller screens. Keep them short so they don't cover the middle of the screenshot.
- Media fields are optional. When missing, the component must render a polished product-style mockup instead of an empty frame.
- The video section should show a poster/placeholder with a play button and open the uploaded video or embed URL inside a Dialog.
- Use `DialogTrigger`'s native button for the video poster. Passing a server-rendered button through `asChild` can omit the trigger from server HTML and cause a hydration mismatch. Verify the trigger is present before hydration and the dialog opens/closes after a full reload.
- Opening the video dialog starts playback: the uploaded video calls `play()` when it mounts (`sections/DialogVideo.tsx`) and YouTube/Vimeo embeds get `autoplay=1`; the click that opened the dialog is the user gesture. Nothing may depend on it: if a browser blocks playback, the native controls stay. Uploaded videos keep native controls, `playsInline` and `preload="metadata"` for iPad Safari/Chrome.
- Homepage video embed URLs should be normalized to player/embed URLs for common providers such as YouTube and Vimeo.
- Feature media must support editable aspect ratios, with `16/9` as the default and `9/16` available for phone portrait mockups.
- Feature tabs and FAQ answers use `forceMount`, so every feature description and answer is in the server HTML. Inactive tabs and closed answers are hidden with CSS.
- "Kuula ise" tiles get their audio from `GET /next/homepage-tts/<hash>`, which is public. It only speaks words shown by a published homepage block (stored tiles, or the default words when the list is empty), so it can't be used as a general speech service. Audio is cached in R2 under the same keys as board speech. See `docs/rules/project/audio-tts.md`.
- Logged-out visitors see a "Proovi tasuta" button to `/register` in the header from the `sm` breakpoint. On phones the hero button does that job, because the header row is full.
- The header sticks to the top of the page (`sticky top-3`) and gets a deeper shadow once the page scrolls; its height stays the same, so the content doesn't jump.
  - Header height: 80px on phones (the logo's `-my-1.5` drops the empty space its `scale-[0.82]` leaves), about 100px from `sm` up.
  - Two values depend on that height; change them with it:
    - the hero's pull-up under the header in `SuhtlejaHomepage/Component.tsx`: `-mt-[144px]`/`pt-[144px]` on phones, `167px` from `sm` up (header top margin + height + page padding);
    - `scroll-pt-[6.5rem] sm:scroll-pt-[7.5rem]` on `<html>`, so anchor links such as `/#hind` stop below the header.
- Visual direction follows the logo: its three slightly tilted tiles (orange, red, blue) are the brand's material. Sections cycle through the logo colours in logo order (`toneAt` in `src/components/Brand`), so items in the same position share a colour.
- Headings use the rounded display face (`font-display`, Nunito, loaded in `src/app/(frontend)/layout.tsx`); body text stays Geist. Check õ, ä, ö, ü, š and ž when changing the face.
- Icons and step numbers sit in `LogoTile`, a small copy of a logo tile with the same gradient and tilt. The hero shows enlarged pale logo tiles behind the product image instead of a gradient wash.
- Use cards only for real objects: the pricing card, the "Kuula ise" device and quotes. Audience cards, steps, reasons and FAQ are open layouts on the section background.
- "Kuula ise" is the page's one bold element: a device frame with AAC-style tiles (coloured borders), where each tap says the word and adds it to a sentence bar. The bar mirrors the app's bottom bar: green button says the sentence, undo removes the last word, red button clears.
- Section labels are short sentence-case text with a small tilted colour square, not tracked capitals. Buttons and links don't get arrow icons.
- Keep the page calm: two coloured bands at most (the orange-tinted "Kuula ise" section and the orange closing band) and no autoplay.
- Motion has a job and plays once; don't add entrance animations to every section. The moments are:
  - hero load: the backdrop tiles drop into place, then the floating labels pop in;
  - "Kuula ise": the first tile pulses three times when the board scrolls into view (until the first tap), the speaking tile shows sound bars, words pop onto the sentence bar, and the word being said is highlighted there;
  - steps: they appear in order and the dashed line draws on to the next step when the list scrolls into view (`Reveal` in `src/components/Brand/Reveal.tsx`);
  - feature tabs: the selected panel fades up.
- Every animation uses `motion-safe:` or checks `prefers-reduced-motion`, and content is visible without JavaScript: `Reveal` hides only content that is still below the fold after hydration.
- Keep copy in Estonian and avoid overclaiming clinical outcomes.

## Removed fields

The old bottom "Kellele sobib" section had an image, a checklist (`audience.items`) and a button (`audience.cta`). These fields left the config in the `homepage_sections` migration, but their columns and table stay in D1 so no stored content is deleted. Nothing reads them. The checklist copy now lives in the pricing list, and the button text in the closing section.

## Change Checklist

- If block fields change, run `pnpm generate:types`, then create and review the migration (see the D1 table rebuild warning in `AGENTS.md`).
- Re-check the hero on mobile and desktop if layout, copy length, or media aspect ratios change.
- Keep video replaceable through either uploaded media or an external embed URL.
