/**
 * Localization: Patina's own user-facing texts (validation messages, preview lines, value
 * names, UI defaults) in English and German, and host-provided labels that can be given per
 * language: `label: { de: "Anrufe", en: "Calls" }`.
 */

/** A host-provided text: one string, or one per language ({ en: "Calls", de: "Anrufe" }). */
export type Text = string | Readonly<Record<string, string>>;

/** German uses the formal "Sie", as is usual in business software. */
export const SUPPORTED_LOCALES = ["en", "de"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Picks the best supported locale from a preference: "de", "de-AT", or a whole
 * Accept-Language header ("de-DE,de;q=0.9,en;q=0.8"). Falls back to English.
 */
export function pickLocale(preference?: string | null): Locale {
  if (!preference) return DEFAULT_LOCALE;
  const ranked = preference
    .split(",")
    .map((part, i) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { lang: tag.trim().toLowerCase().split("-")[0] ?? "", q: Number.isNaN(q) ? 0 : q, i };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { lang } of ranked)
    if ((SUPPORTED_LOCALES as readonly string[]).includes(lang)) return lang as Locale;
  return DEFAULT_LOCALE;
}

/** Resolves a host text for a locale: exact, then base language, then English, then any. */
export function tx(t: Text | undefined, locale: string = DEFAULT_LOCALE): string | undefined {
  if (t === undefined || typeof t === "string") return t;
  const base = locale.toLowerCase().split("-")[0] ?? locale;
  return t[locale] ?? t[base] ?? t[DEFAULT_LOCALE] ?? Object.values(t)[0];
}

type P = Record<string, string | number>;

const en = {
  // engine: validation (shown to users as refusal reasons)
  malformedOp: () => "This change isn't in a format Patina understands.",
  notApplied: () => "This change could not be applied.",
  unknownNode: (p: P) => `There is no “${p.id}” on this page.`,
  propNotCustomizable: (p: P) => `${p.prop} of ${p.name} can't be changed.`,
  propNotReplaceable: (p: P) => `${p.prop} of ${p.name} can't be replaced as a whole.`,
  noSuchSetting: (p: P) => `${p.name} has no setting called “${p.setting}”.`,
  noItems: (p: P) => `${p.prop} of ${p.name} has no items.`,
  noSuchItem: (p: P) => `${p.name} has no ${p.item}.`,
  keyFixed: (p: P) => `The key of ${p.item} can't be changed.`,
  notHideable: (p: P) => `${p.item} can't be hidden.`,
  hiddenOnOff: () => "Hidden must be on or off.",
  fieldInvalid: (p: P) => `${p.field} of ${p.item} ${p.error}.`,
  propInvalid: (p: P) => `${p.prop} ${p.error}.`,
  queryInvalid: (p: P) => `${p.name} ${p.error}.`,
  newQueryInvalid: (p: P) => `A new ${p.preset} ${p.error}.`,
  noOrder: (p: P) => `${p.prop} of ${p.name} has no order.`,
  orderFixed: (p: P) => `The order of ${p.prop} in ${p.name} is fixed.`,
  cantPlace: (p: P) => `Can't place ${p.item} next to “${p.anchor}”.`,
  cantAdd: (p: P) => `${p.preset} isn't something you can add here.`,
  youCanAdd: (p: P) => ` You can add: ${p.options}.`,
  cantGoIn: (p: P) => `${p.preset} can't go in ${p.name}.`,
  newKeyPrefix: (p: P) => `New items need a key starting with “${p.prefix}”.`,
  duplicateKey: (p: P) => `Something called “${p.key}” already exists.`,
  presetNoSetting: (p: P) => `${p.preset} has no setting called “${p.setting}”.`,
  onlyHide: (p: P) => `Items in ${p.name} can be hidden but not removed.`,
  baseNotRemovable: (p: P) => `${p.name} is part of the page and can be hidden, but not removed.`,
  // values: reasons a value is invalid (completes "<Setting> …")
  mustBeOneOf: (p: P) => `must be one of ${p.options}`,
  mustBeWholeNumber: (p: P) => `must be a whole number from ${p.min} to ${p.max}`,
  mustBeOnOff: () => "must be on or off",
  mustBeText: () => "must be text",
  atMostChars: (p: P) => `must be at most ${p.max} characters`,
  disallowedChars: () => "contains characters that aren't allowed",
  mustSortBy: (p: P) => `must sort by one of ${p.options}, ascending or descending`,
  wrongShape: () => "has the wrong shape",
  unknownField: (p: P) => `has an unknown field "${p.field}"`,
  missingField: (p: P) => `is missing "${p.field}"`,
  notReplaceable: () => "cannot be replaced as a whole; change its items instead",
  or: () => "or",
  // values: names
  default: () => "the default",
  on: () => "on",
  off: () => "off",
  ascending: () => "ascending",
  descending: () => "descending",
  yes: () => "Yes",
  no: () => "No",
  // queries (data views)
  queryMustDescribe: () => "must describe which data to show",
  queryCantUse: (p: P) => `can't use “${p.key}” here`,
  queryOnlyFrom: (p: P) => `can only show data from ${p.sources}`,
  queryNoData: () => "has no data available",
  queryFieldUnavailable: (p: P) =>
    `can't use “${p.field}”: it isn't available to you in ${p.source}`,
  queryFieldWrongWay: (p: P) => `can't use ${p.field} that way`,
  queryFieldDisplayOnly: (p: P) =>
    `can show ${p.field} as a column, but not filter, group, sort or count by it`,
  queryMaxFilters: () => "can have at most 3 filters",
  queryBadParam: (p: P) => `can't use that value for ${p.param}`,
  queryBadFilter: () => "has a malformed filter",
  queryCantFilter: (p: P) => `can't filter ${p.field} by “${p.value}”`,
  queryFieldCount: (p: P) => `needs 1 to ${p.max} fields`,
  queryFieldTwice: () => "lists a field twice",
  queryBadSort: () => "has a malformed sort",
  querySortDir: () => "must sort ascending or descending",
  queryMaxRows: (p: P) => `can show at most ${p.max} rows`,
  queryNotComplete: (p: P) =>
    `${p.source} can't be summarized (the app doesn't return all of it at once)`,
  queryMetricOneOf: (p: P) => `must compute one of: ${p.ops}`,
  queryCountRows: () => "counts rows, not a field",
  queryNeedsNumber: (p: P) => `needs a number field to ${p.op}`,
  queryNeedsGroup: () => "needs something to group by",
  queryDateBucket: () => "must group dates by day, week or month",
  queryBadGroup: () => "has a malformed grouping",
  queryCantGroup: (p: P) => `can't group by ${p.field}`,
  queryOnlyDatesBucket: () => "only groups dates by day, week or month",
  // query labels (block titles)
  opCount: () => "Number of",
  opSum: () => "Total",
  opSumOf: () => "Sum of",
  opAvg: () => "Average",
  opMin: () => "Lowest",
  opMax: () => "Highest",
  by: () => "by",
  where: () => "where",
  is: () => "is",
  and: () => "and",
  bucketDay: () => "day",
  bucketWeek: () => "week",
  bucketMonth: () => "month",
  // preview lines (describe)
  setProp: (p: P) => `Set ${p.prop} to ${p.value} in ${p.name}`,
  setField: (p: P) => `Set ${p.field} of ${p.item} to ${p.value}${p.inName}`,
  inName: (p: P) => ` in ${p.name}`,
  hide: (p: P) => `Hide ${p.item}${p.inName}`,
  show: (p: P) => `Show ${p.item}${p.inName}`,
  move: (p: P) => `Move ${p.item} ${p.place}${p.inName}`,
  add: (p: P) => `Add ${p.preset}${p.what} ${p.place}`,
  remove: (p: P) => `Remove ${p.name}`,
  toStart: () => "to the start",
  toEnd: () => "to the end",
  before: (p: P) => `before ${p.item}`,
  after: (p: P) => `after ${p.item}`,
  // migrations
  unreadableFormat: () => "This change was saved in a format this version can't read.",
  // model fallbacks
  refusalFallback: () => "That isn't something this view can do.",
  clarifyFallback: () => "Could you say a bit more?",
  // server
  typeSomething: () => "Type what you'd like to change.",
  promptTooLong: (p: P) => `Please keep requests under ${p.max} characters.`,
  rateLimited: () => "That's a lot of changes at once. Try again in a minute.",
  quotaUser: (p: P) => `You've used all ${p.max} customization requests for this month.`,
  quotaTenant: () => "Your organization has used all its customization requests for this month.",
  modelUnavailable: () => "The assistant is unavailable right now. Please try again.",
  nothingToChange: () => "I couldn't find anything on this page to change for that request.",
  notPossible: () => "That change isn't possible here.",
  safetyDecline: () => "I can't help with that request here.",
  previewGone: () => "This preview is no longer available. Please ask again.",
  viewChanged: () => "Your view changed since this preview. Please ask again.",
  customizeOff: () => "Customizing this view isn't available on your account.",
  dataViewsOff: () => "Creating new charts, tables and cards isn't available on your account.",
  somethingWrong: () => "Something went wrong.",
  staleUndo: () => "Your view changed in the meantime. Here is the current state.",
  nothingToRedo: () => "There's nothing to redo.",
  guardWhichOne: () => "Which of these did you mean?",
  answerLeadFor: (p: P) => `Here is what you can change in ${p.what}:`,
  answerLead: () => "Here is what you can change on this page:",
  answerNothing: () => "Nothing on this page can be changed for you right now.",
  answerDataFields: (p: P) => `A new table from ${p.what} can show: ${p.fields}`,
  // react defaults
  promptLabel: () => "Customize this view",
  promptPlaceholder: () => "Describe a change, e.g. “hide the revenue column”",
  preview: () => "Preview",
  thinking: () => "Thinking…",
  apply: () => "Apply",
  discard: () => "Discard",
  proposedChanges: () => "Proposed changes",
  undo: () => "Undo",
  redo: () => "Redo",
  reset: () => "Reset to default",
  skippedOne: () => "1 of your earlier changes no longer applies",
  skippedMany: (p: P) => `${p.count} of your earlier changes no longer apply`,
  shipped: (p: P) => `You asked for “${p.title}”. That's now possible.`,
  dismiss: () => "Dismiss",
  notConfigured: () => "Customizing isn't set up here yet.",
  capReorder: () => "reorder",
  capHide: () => "hide",
  capArrange: (p: P) => `${p.what} (${p.items}): ${p.verbs}`,
  capAdd: (p: P) => `${p.what}: add ${p.items}`,
  capSet: (p: P) => (p.values ? `${p.what}: ${p.values}` : String(p.what)),
  capData: (p: P) => `New views of ${p.what}: ${p.fields}`,
  capHintData: (p: P) => `You can add tables, charts and numbers from ${p.sources}.`,
  capHintArrange: (p: P) => `rearrange or hide ${p.what}`,
  capHintSet: (p: P) => `set ${p.what}${p.values}`,
  capHintAddData: (p: P) => `add views of ${p.sources}`,
  capHintPage: (p: P) => `Here you can ${p.parts}.`,
  capTitle: () => "What you can ask for",
  exMoveTop: (p: P) => `Move ${p.item} to the top`,
  exHide: (p: P) => `Hide ${p.item}`,
  exSet: (p: P) => `Set ${p.what} to ${p.value}`,
  exChart: (p: P) => `Add a chart of ${p.what} by ${p.field}`,
  exTable: (p: P) => `Add a table of ${p.what}`,
  loadError: (p: P) => `Couldn't load data (${p.status})`,
  // data blocks (labels users see in previews)
  blockTable: () => "Table",
  blockChart: () => "Chart",
  blockStat: () => "Number card",
  chartType: () => "Chart type",
  data: () => "Data",
  loading: () => "Loading…",
  unavailable: () => "This data isn't available to you.",
  nothingToShow: () => "Nothing to show.",
};

export type MessageKey = keyof typeof en;
type Catalog = { [K in MessageKey]: (p: P) => string };

const de: Catalog = {
  malformedOp: () => "Diese Änderung hat ein Format, das Patina nicht versteht.",
  notApplied: () => "Diese Änderung konnte nicht angewendet werden.",
  unknownNode: (p) => `Auf dieser Seite gibt es kein „${p.id}“.`,
  propNotCustomizable: (p) => `${p.prop} von ${p.name} kann nicht geändert werden.`,
  propNotReplaceable: (p) => `${p.prop} von ${p.name} kann nicht als Ganzes ersetzt werden.`,
  noSuchSetting: (p) => `${p.name} hat keine Einstellung „${p.setting}“.`,
  noItems: (p) => `${p.prop} von ${p.name} hat keine Einträge.`,
  noSuchItem: (p) => `${p.name} hat kein „${p.item}“.`,
  keyFixed: (p) => `Der Schlüssel von ${p.item} kann nicht geändert werden.`,
  notHideable: (p) => `${p.item} kann nicht ausgeblendet werden.`,
  hiddenOnOff: () => "Ausgeblendet muss an oder aus sein.",
  fieldInvalid: (p) => `${p.field} von ${p.item} ${p.error}.`,
  propInvalid: (p) => `${p.prop} ${p.error}.`,
  queryInvalid: (p) => `${p.name} ${p.error}.`,
  newQueryInvalid: (p) => `Ein neues Element „${p.preset}“ ${p.error}.`,
  noOrder: (p) => `${p.prop} von ${p.name} hat keine Reihenfolge.`,
  orderFixed: (p) => `Die Reihenfolge von ${p.prop} in ${p.name} ist fest.`,
  cantPlace: (p) => `${p.item} kann nicht neben „${p.anchor}“ platziert werden.`,
  cantAdd: (p) => `${p.preset} kann hier nicht hinzugefügt werden.`,
  youCanAdd: (p) => ` Möglich ist: ${p.options}.`,
  cantGoIn: (p) => `${p.preset} passt nicht in ${p.name}.`,
  newKeyPrefix: (p) => `Neue Einträge brauchen einen Schlüssel, der mit „${p.prefix}“ beginnt.`,
  duplicateKey: (p) => `„${p.key}“ gibt es bereits.`,
  presetNoSetting: (p) => `${p.preset} hat keine Einstellung „${p.setting}“.`,
  onlyHide: (p) => `Einträge in ${p.name} können ausgeblendet, aber nicht entfernt werden.`,
  baseNotRemovable: (p) =>
    `${p.name} gehört zur Seite und kann ausgeblendet, aber nicht entfernt werden.`,
  mustBeOneOf: (p) => `muss eines davon sein: ${p.options}`,
  mustBeWholeNumber: (p) => `muss eine ganze Zahl von ${p.min} bis ${p.max} sein`,
  mustBeOnOff: () => "muss an oder aus sein",
  mustBeText: () => "muss Text sein",
  atMostChars: (p) => `darf höchstens ${p.max} Zeichen lang sein`,
  disallowedChars: () => "enthält Zeichen, die nicht erlaubt sind",
  mustSortBy: (p) => `muss nach einem davon sortieren: ${p.options}, auf- oder absteigend`,
  wrongShape: () => "hat die falsche Form",
  unknownField: (p) => `hat ein unbekanntes Feld „${p.field}“`,
  missingField: (p) => `fehlt „${p.field}“`,
  notReplaceable: () => "kann nicht als Ganzes ersetzt werden; ändern Sie stattdessen die Einträge",
  or: () => "oder",
  default: () => "den Standard",
  on: () => "an",
  off: () => "aus",
  ascending: () => "aufsteigend",
  descending: () => "absteigend",
  yes: () => "Ja",
  no: () => "Nein",
  queryMustDescribe: () => "muss beschreiben, welche Daten angezeigt werden",
  queryCantUse: (p) => `kann „${p.key}“ hier nicht verwenden`,
  queryOnlyFrom: (p) => `kann nur Daten aus ${p.sources} anzeigen`,
  queryNoData: () => "hat keine verfügbaren Daten",
  queryFieldUnavailable: (p) =>
    `kann „${p.field}“ nicht verwenden: Es ist für Sie in ${p.source} nicht verfügbar`,
  queryFieldWrongWay: (p) => `kann ${p.field} so nicht verwenden`,
  queryFieldDisplayOnly: (p) =>
    `kann ${p.field} als Spalte anzeigen, aber nicht danach filtern, gruppieren, sortieren oder zählen`,
  queryMaxFilters: () => "kann höchstens 3 Filter haben",
  queryBadParam: (p) => `kann diesen Wert für ${p.param} nicht verwenden`,
  queryBadFilter: () => "hat einen ungültigen Filter",
  queryCantFilter: (p) => `kann ${p.field} nicht nach „${p.value}“ filtern`,
  queryFieldCount: (p) => `braucht 1 bis ${p.max} Felder`,
  queryFieldTwice: () => "enthält ein Feld doppelt",
  queryBadSort: () => "hat eine ungültige Sortierung",
  querySortDir: () => "muss auf- oder absteigend sortieren",
  queryMaxRows: (p) => `kann höchstens ${p.max} Zeilen anzeigen`,
  queryNotComplete: (p) =>
    `${p.source} kann nicht zusammengefasst werden (die App liefert nicht alles auf einmal)`,
  queryMetricOneOf: (p) => `muss eines davon berechnen: ${p.ops}`,
  queryCountRows: () => "zählt Zeilen, kein Feld",
  queryNeedsNumber: (p) => `braucht ein Zahlenfeld für ${p.op}`,
  queryNeedsGroup: () => "braucht etwas, wonach gruppiert wird",
  queryDateBucket: () => "muss Datumswerte nach Tag, Woche oder Monat gruppieren",
  queryBadGroup: () => "hat eine ungültige Gruppierung",
  queryCantGroup: (p) => `kann nicht nach ${p.field} gruppieren`,
  queryOnlyDatesBucket: () => "gruppiert nur Datumswerte nach Tag, Woche oder Monat",
  opCount: () => "Anzahl",
  opSum: () => "Summe",
  opSumOf: () => "Summe von",
  opAvg: () => "Durchschnitt",
  opMin: () => "Minimum",
  opMax: () => "Maximum",
  by: () => "nach",
  where: () => "wo",
  is: () => "ist",
  and: () => "und",
  bucketDay: () => "Tag",
  bucketWeek: () => "Woche",
  bucketMonth: () => "Monat",
  setProp: (p) => `${p.prop} in ${p.name} auf ${p.value} setzen`,
  setField: (p) => `${p.field} von ${p.item}${p.inName} auf ${p.value} setzen`,
  inName: (p) => ` in ${p.name}`,
  hide: (p) => `${p.item}${p.inName} ausblenden`,
  show: (p) => `${p.item}${p.inName} einblenden`,
  move: (p) => `${p.item}${p.inName} ${p.place} verschieben`,
  add: (p) => `${p.preset}${p.what} ${p.place} hinzufügen`,
  remove: (p) => `${p.name} entfernen`,
  toStart: () => "an den Anfang",
  toEnd: () => "ans Ende",
  before: (p) => `vor ${p.item}`,
  after: (p) => `hinter ${p.item}`,
  unreadableFormat: () =>
    "Diese Änderung wurde in einem Format gespeichert, das diese Version nicht lesen kann.",
  refusalFallback: () => "Das kann diese Ansicht nicht.",
  clarifyFallback: () => "Können Sie das genauer beschreiben?",
  typeSomething: () => "Beschreiben Sie, was Sie ändern möchten.",
  promptTooLong: (p) => `Bitte halten Sie Anfragen unter ${p.max} Zeichen.`,
  rateLimited: () =>
    "Das sind viele Änderungen auf einmal. Bitte versuchen Sie es in einer Minute erneut.",
  quotaUser: (p) => `Sie haben alle ${p.max} Anpassungsanfragen für diesen Monat verbraucht.`,
  quotaTenant: () => "Ihre Organisation hat alle Anpassungsanfragen für diesen Monat verbraucht.",
  modelUnavailable: () =>
    "Der Assistent ist gerade nicht erreichbar. Bitte versuchen Sie es erneut.",
  nothingToChange: () => "Ich habe auf dieser Seite nichts gefunden, was ich dafür ändern könnte.",
  notPossible: () => "Diese Änderung ist hier nicht möglich.",
  safetyDecline: () => "Dabei kann ich hier nicht helfen.",
  previewGone: () => "Diese Vorschau ist nicht mehr verfügbar. Bitte fragen Sie erneut.",
  viewChanged: () =>
    "Ihre Ansicht hat sich seit dieser Vorschau geändert. Bitte fragen Sie erneut.",
  customizeOff: () => "Das Anpassen dieser Ansicht ist für Ihr Konto nicht verfügbar.",
  dataViewsOff: () => "Neue Diagramme, Tabellen und Kennzahlen sind für Ihr Konto nicht verfügbar.",
  somethingWrong: () => "Etwas ist schiefgelaufen.",
  staleUndo: () => "Ihre Ansicht hat sich inzwischen geändert. Hier ist der aktuelle Stand.",
  nothingToRedo: () => "Es gibt nichts wiederherzustellen.",
  guardWhichOne: () => "Welche dieser Möglichkeiten meinten Sie?",
  answerLeadFor: (p) => `Das können Sie bei ${p.what} ändern:`,
  answerLead: () => "Das können Sie auf dieser Seite ändern:",
  answerNothing: () => "Auf dieser Seite können Sie im Moment nichts ändern.",
  answerDataFields: (p) => `Eine neue Tabelle aus ${p.what} kann zeigen: ${p.fields}`,
  promptLabel: () => "Diese Ansicht anpassen",
  promptPlaceholder: () => "Beschreiben Sie eine Änderung, z. B. „Umsatzspalte ausblenden“",
  preview: () => "Vorschau",
  thinking: () => "Denke nach…",
  apply: () => "Übernehmen",
  discard: () => "Verwerfen",
  proposedChanges: () => "Vorgeschlagene Änderungen",
  undo: () => "Rückgängig",
  redo: () => "Wiederherstellen",
  reset: () => "Auf Standard zurücksetzen",
  skippedOne: () => "1 Ihrer früheren Änderungen gilt nicht mehr",
  skippedMany: (p) => `${p.count} Ihrer früheren Änderungen gelten nicht mehr`,
  shipped: (p) => `Sie hatten sich „${p.title}“ gewünscht. Das ist jetzt möglich.`,
  dismiss: () => "Ausblenden",
  notConfigured: () => "Das Anpassen ist hier noch nicht eingerichtet.",
  capReorder: () => "umordnen",
  capHide: () => "ausblenden",
  capArrange: (p) => `${p.what} (${p.items}): ${p.verbs}`,
  capAdd: (p) => `${p.what}: ${p.items} hinzufügen`,
  capSet: (p) => (p.values ? `${p.what}: ${p.values}` : String(p.what)),
  capData: (p) => `Neue Ansichten aus ${p.what}: ${p.fields}`,
  capHintData: (p) => `Sie können Tabellen, Diagramme und Kennzahlen aus ${p.sources} hinzufügen.`,
  capHintArrange: (p) => `${p.what} umordnen oder ausblenden`,
  capHintSet: (p) => `${p.what}${p.values} festlegen`,
  capHintAddData: (p) => `Ansichten aus ${p.sources} hinzufügen`,
  capHintPage: (p) => `Hier können Sie ${p.parts}.`,
  capTitle: () => "Was Sie anfragen können",
  exMoveTop: (p) => `${p.item} nach oben verschieben`,
  exHide: (p) => `${p.item} ausblenden`,
  exSet: (p) => `${p.what} auf ${p.value} setzen`,
  exChart: (p) => `Diagramm: ${p.what} nach ${p.field}`,
  exTable: (p) => `Tabelle mit ${p.what} hinzufügen`,
  loadError: (p) => `Daten konnten nicht geladen werden (${p.status})`,
  blockTable: () => "Tabelle",
  blockChart: () => "Diagramm",
  blockStat: () => "Kennzahl",
  chartType: () => "Diagrammtyp",
  data: () => "Daten",
  loading: () => "Wird geladen…",
  unavailable: () => "Diese Daten sind für Sie nicht verfügbar.",
  nothingToShow: () => "Nichts anzuzeigen.",
};

const CATALOGS: Record<Locale, Catalog> = { en: en as Catalog, de };

/** One of Patina's own messages in a locale (English if the locale isn't supported). */
export function msg(locale: string | undefined, key: MessageKey, params: P = {}): string {
  const catalog = CATALOGS[pickLocale(locale)];
  return catalog[key](params);
}

/** Both languages of one message, as a host `Text` (for labels Patina itself provides). */
export function msgText(key: MessageKey): Text {
  return Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, CATALOGS[l][key]({})]));
}

/** Locale-aware "a, b or c" / "a, b oder c". */
/** "a, b and c" in the locale. */
export function listAnd(items: string[], locale?: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${msg(locale, "and")} ${items[items.length - 1]}`;
}

export function listOr(items: string[], locale?: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${msg(locale, "or")} ${items[items.length - 1]}`;
}

export const RELATIVE_RANGE_TEXT: Record<string, Record<Locale, string>> = {
  today: { en: "Today", de: "Heute" },
  yesterday: { en: "Yesterday", de: "Gestern" },
  thisWeek: { en: "This week", de: "Diese Woche" },
  lastWeek: { en: "Last week", de: "Letzte Woche" },
  thisMonth: { en: "This month", de: "Dieser Monat" },
  lastMonth: { en: "Last month", de: "Letzter Monat" },
  last7Days: { en: "Last 7 days", de: "Letzte 7 Tage" },
  last30Days: { en: "Last 30 days", de: "Letzte 30 Tage" },
  last90Days: { en: "Last 90 days", de: "Letzte 90 Tage" },
  thisYear: { en: "This year", de: "Dieses Jahr" },
};
