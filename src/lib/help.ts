/**
 * Help articles. The help panel shows the articles for the screen the person is on first.
 * To add help for a screen, add an article with that screen's id in `screens`.
 */
export interface HelpArticle {
  id: string;
  title: string;
  screens: string[]; // dashboard, overview, edit, languages, publish, history, backups, settings, bulk, activity, transfer
  steps: string[];
  note?: string;
}

export const HELP: HelpArticle[] = [
  {
    id: "new-campaign",
    title: "Start a new campaign from an existing website",
    screens: ["dashboard", "overview"],
    steps: [
      "On the Websites page, find a website that looks like what the client needs and press “Copy for new campaign”.",
      "Type the new name (the web address fills in automatically) and choose the client. Press “Create copy”.",
      "Follow the checklist on the new website: brand, pictures, texts and offers, contact details.",
      "Use “Preview” to check every language, then publish. The original website is never touched.",
    ],
    note: "Contact details, analytics IDs, enquiries, history and backups are never copied, so one client’s private information cannot end up on another client’s website.",
  },
  {
    id: "edit",
    title: "Change texts, pictures and offers",
    screens: ["edit", "overview"],
    steps: [
      "Choose a section on the left (e.g. Offers).",
      "Pick the language at the top. When editing Tamil or Sinhala, the main-language text is shown above each box for reference.",
      "Make your changes and press “Save draft”. Saving never changes the live website.",
      "Use “Preview” to see the result, then “Send for review” (editors) or “Publish” (reviewers).",
    ],
    note: "If a colleague is editing the same website, you will see their name at the top. If you both change the same text, SiteDesk asks which version to keep – nothing is overwritten silently.",
  },
  {
    id: "languages",
    title: "Add a language and use the client’s translations",
    screens: ["languages", "edit"],
    steps: [
      "Open Languages and add the language. It starts hidden – visitors cannot see it.",
      "Press “Download translation spreadsheet”. Send it to the client or translator; they fill in their column.",
      "Upload the completed file. SiteDesk shows where every text will go and what is still missing – then press “Use these translations”.",
      "When a language is complete, switch it to “Visible” and publish. Unfinished languages cannot be made visible by mistake.",
    ],
  },
  {
    id: "publish",
    title: "Check and publish changes",
    screens: ["publish", "overview"],
    steps: [
      "The Publish page lists every change waiting to go live, in plain language, with the old and new value.",
      "Untick anything that is not ready, or filter by language (e.g. publish only English and Tamil).",
      "SiteDesk checks the result first (missing translations, contact details, analytics IDs). Problems are explained with what to do.",
      "Press “Publish”. A backup is made automatically. If the launch fails, the live website keeps showing the previous version.",
    ],
  },
  {
    id: "bulk",
    title: "Update an offer or contact details on several websites",
    screens: ["bulk", "dashboard"],
    steps: [
      "Open “Update several websites”.",
      "Choose what to change: an offer (found by its offer code on every website) or a contact detail.",
      "Tick the websites and languages to change, and type the new value.",
      "Check the preview: it lists every value that will change and everything that will stay the same. Then save to drafts or publish straight away.",
    ],
    note: "Only the values you chose are published. Other unpublished work on those websites stays in draft.",
  },
  {
    id: "mistake",
    title: "Undo a mistake (go back to an earlier version)",
    screens: ["history", "overview"],
    steps: [
      "Open History. The version marked LIVE is what visitors see now. Each version says what changed, who published it and when.",
      "Find the correct earlier version and press “Go back to this version”.",
      "SiteDesk shows exactly what will change back. Confirm, and it is live straight away.",
    ],
    note: "Going back creates a new version – nothing is deleted, so you can always go forward again. The same fields are also corrected in the draft so the mistake is not published again later.",
  },
  {
    id: "backup",
    title: "Restore a whole website from a backup",
    screens: ["backups", "history"],
    steps: [
      "Open Backups. A backup is made automatically before every launch; you can also make one yourself.",
      "Press “Restore…” next to a backup. SiteDesk lists what will be restored and what will be replaced.",
      "Confirm. A safety backup of the current state is taken first, so the restore itself can be undone.",
    ],
  },
  {
    id: "failed",
    title: "A launch failed – what now?",
    screens: ["overview", "activity", "publish", "history"],
    steps: [
      "The website and the Activity page show a red message saying what happened and what to do next.",
      "Visitors still see the previous version – nothing is broken.",
      "Fix what the message says (if anything) and press “Try again”.",
    ],
  },
  {
    id: "analytics",
    title: "Connect Google Analytics or Tag Manager",
    screens: ["settings"],
    steps: [
      "In Google Analytics: Admin › Data streams › your website – copy the Measurement ID (starts with G-).",
      "In Google Tag Manager: the container ID is at the top of the workspace (starts with GTM-).",
      "Paste them in Settings › Analytics and save. They go live with the next publish.",
    ],
  },
  {
    id: "transfer",
    title: "Move a website to another workspace",
    screens: ["transfer", "settings"],
    steps: [
      "In Settings › Transfer, download the website package. Choose whether to include contact details and analytics IDs.",
      "Switch to the other workspace (top right), open Transfer and upload the package.",
      "The website arrives as a draft with all its pages and languages – nothing needs rebuilding. Publish it when ready.",
    ],
    note: "Packages never contain enquiries, team members or internal notes.",
  },
  {
    id: "roles",
    title: "Who can do what",
    screens: ["dashboard", "activity", "team"],
    steps: [
      "Content editors prepare changes and send them for review. They cannot make anything live.",
      "Reviewers / publishers check changes, publish them, and can go back to earlier versions.",
      "Operations admins can do everything for every client, including transfers.",
      "People only see the clients they work for.",
    ],
  },
  {
    id: "team",
    title: "Add a colleague and give them access",
    screens: ["team"],
    steps: [
      "Open People (top menu). The table shows everyone and which clients they can work on.",
      "Press “Add a person”, fill in their name, email and a first password, then tell them the password privately.",
      "A new person sees nothing until you give them access: on their row, pick “Content editor” or “Reviewer / publisher” under a client.",
      "“No access” takes a client away again. The change applies the next time they load a page.",
      "Tick “Operations admin” only for people who should reach every client – their per-client choices are then handled for them.",
      "Every change is written to Activity, so you can always see who gave access to whom.",
    ],
    note: "The last operations admin cannot be removed – otherwise nobody could manage access any more.",
  },
  {
    id: "audit-export",
    title: "Keep a copy of the activity log",
    screens: ["activity"],
    steps: [
      "Open Activity and press “Download as spreadsheet” next to “Who did what”.",
      "The file opens in Excel or Google Sheets and holds when, who, what, which client and which website.",
      "It covers the clients you have access to, in the workspace you are currently in.",
    ],
  },
];

export function helpFor(screen: string): HelpArticle[] {
  const first = HELP.filter((h) => h.screens.includes(screen));
  return [...first, ...HELP.filter((h) => !h.screens.includes(screen))];
}

export function screenFromPath(pathname: string): string {
  if (pathname.startsWith("/app/bulk")) return "bulk";
  if (pathname.startsWith("/app/activity")) return "activity";
  if (pathname.startsWith("/app/transfer")) return "transfer";
  if (pathname.startsWith("/app/team")) return "team";
  if (pathname.startsWith("/app/search")) return "search";
  const m = pathname.match(/^\/app\/sites\/[^/]+\/?([a-z]*)/);
  if (m) return m[1] || "overview";
  return "dashboard";
}
