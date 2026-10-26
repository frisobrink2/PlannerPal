export type Priority = "Hoog" | "Normaal" | "Laag";
export type Mail = {
  id: number;
  name: string;
  company: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  color: string;
  task: string;
  duration: number;
  priority: Priority;
  deadline: string;
  reply: string;
};
export type Task = {
  id: number;
  mailId: number;
  title: string;
  duration: number;
  priority: Priority;
  deadline: string;
  done: boolean;
  start?: number;
};
export type Draft = { mailId: number; text: string; approved: boolean };
export type State = { tasks: Task[]; drafts: Draft[]; read: number[] };
const rows: [
  string,
  string,
  string,
  string,
  string,
  number,
  Priority,
  string,
  string,
][] = [
  [
    "Sophie de Vries",
    "Studio Noord",
    "Feedback op het merkvoorstel",
    "Dank voor je presentatie! We hebben de feedback verzameld. Kun je de kleurvarianten en het logo op de laatste pagina aanpassen? We ontvangen graag woensdag een nieuwe versie.",
    "Merkvoorstel Studio Noord aanpassen",
    60,
    "Hoog",
    "2026-10-28",
    "Hoi Sophie, dank voor jullie heldere feedback! Ik verwerk de kleurvarianten en het logo en stuur uiterlijk woensdag een nieuwe versie. Groet!",
  ],
  [
    "Mark Jansen",
    "Jansen & Partners",
    "Offerte voor de nieuwe website",
    "We willen graag samenwerken aan onze nieuwe website. Kun je uiterlijk dinsdag een offerte sturen voor ontwerp en realisatie van vijf pagina’s? Ons budget is ongeveer € 4.500.",
    "Offerte website opstellen",
    45,
    "Hoog",
    "2026-10-27",
    "Hoi Mark, leuk om van je te horen. Ik maak een voorstel voor het ontwerp en de realisatie van vijf pagina’s binnen de besproken scope. Je ontvangt het uiterlijk dinsdag.",
  ],
  [
    "Lisa Bakker",
    "Bakker Administratie",
    "Btw-aangifte: stukken oktober",
    "Voor de btw-aangifte mis ik nog je inkoopfacturen van oktober. Wil je die deze week verzamelen en aanleveren? Denk ook aan je softwareabonnementen.",
    "Inkoopfacturen verzamelen",
    30,
    "Normaal",
    "2026-10-30",
    "Hoi Lisa, ik verzamel de inkoopfacturen, inclusief de softwareabonnementen. Ik lever alles deze week bij je aan.",
  ],
  [
    "Daan Visser",
    "Collectief West",
    "Koffie en even bijpraten?",
    "Het is alweer even geleden! Zin om volgende week een koffie te drinken? Dinsdag of donderdag rond 10 uur zou voor mij goed werken.",
    "Koffieafspraak met Daan afstemmen",
    15,
    "Laag",
    "2026-10-30",
    "Hoi Daan, gezellig! Donderdag rond 10 uur lijkt me fijn. Zullen we bij de koffiebar op de hoek afspreken? Laat even weten of dat past.",
  ],
  [
    "Emma Smit",
    "Bloom",
    "Landingspagina: laatste controle",
    "De landingspagina staat op de testomgeving. Kun je de mobiele versie en het contactformulier nog controleren voordat we donderdag live gaan?",
    "Landingspagina Bloom controleren",
    45,
    "Hoog",
    "2026-10-28",
    "Hoi Emma, ik controleer de mobiele weergave en het contactformulier voor de livegang. Ik stuur je daarna mijn bevindingen.",
  ],
  [
    "Tom van Dijk",
    "Van Dijk Fotografie",
    "Beelden voor Studio Noord",
    "Hierbij de selectie van de fotoshoot. Wil je doorgeven welke tien beelden jullie willen gebruiken? Dan lever ik ze in hoge resolutie aan.",
    "Tien beelden selecteren",
    30,
    "Normaal",
    "2026-10-29",
    "Hoi Tom, bedankt voor de selectie. Ik kies de tien beelden en stuur je deze week de bestandsnamen door.",
  ],
  [
    "Noor Meijer",
    "Werkplaats Utrecht",
    "Uitnodiging: zelfstandigendag",
    "Op 12 november organiseren we een middag voor zelfstandigen. Er zijn workshops over acquisitie en slim plannen. Wil je laten weten of je erbij bent?",
    "Uitnodiging zelfstandigendag bekijken",
    15,
    "Laag",
    "2026-11-02",
    "Hoi Noor, dank voor de uitnodiging! Ik bekijk het programma en laat je volgende week weten of ik erbij ben.",
  ],
  [
    "Pieter Bos",
    "Bos Architectuur",
    "Planning intake nieuw project",
    "Kun je drie momenten voorstellen voor een intake van een uur? We willen onze nieuwe huisstijl bespreken. Online afspreken is voor ons prima.",
    "Momenten voor projectintake voorstellen",
    15,
    "Normaal",
    "2026-10-28",
    "Hoi Pieter, ik kijk graag met jullie naar de nieuwe huisstijl. Ik stuur je drie opties voor een online intake van een uur.",
  ],
  [
    "Eva Willems",
    "Papier & Co",
    "Proefdruk ligt klaar",
    "De proefdruk van de brochure ligt klaar. Wil je de adresgegevens en paginavolgorde controleren? Na akkoord kunnen we de oplage van 500 stuks drukken.",
    "Proefdruk brochure controleren",
    30,
    "Normaal",
    "2026-10-29",
    "Hoi Eva, bedankt voor het bericht. Ik controleer de adresgegevens en paginavolgorde en kom bij je terug met mijn akkoord of opmerkingen.",
  ],
  [
    "Ruben Dekker",
    "Dekker Digital",
    "Factuur september",
    "Volgens onze administratie staat factuur 2026-091 nog open. Kun je controleren of deze al betaald is? Stuur gerust een betaalbewijs als de betaling onderweg is.",
    "Status factuur 2026-091 controleren",
    15,
    "Hoog",
    "2026-10-27",
    "Hoi Ruben, ik controleer de betaling van factuur 2026-091 en kom er vandaag bij je op terug.",
  ],
  [
    "Julia Peters",
    "Groen Bureau",
    "Samenwerking duurzaamheidsrapport",
    "Voor een duurzaamheidsrapport zoeken we iemand voor de vormgeving. Heb je in november ruimte voor ongeveer twee dagen werk? We horen graag van je.",
    "Beschikbaarheid november bekijken",
    20,
    "Normaal",
    "2026-10-30",
    "Hoi Julia, dank voor je bericht. Het project klinkt interessant. Ik bekijk mijn beschikbaarheid voor november en laat je deze week meer weten.",
  ],
  [
    "Sam van Leeuwen",
    "Plan & Groei",
    "Notities van onze strategiesessie",
    "Bedankt voor de fijne sessie van vrijdag. In de notities staan drie acties voor je positionering. Wil je deze doornemen en je opmerkingen verzamelen voor ons volgende gesprek?",
    "Acties strategiesessie doornemen",
    30,
    "Laag",
    "2026-11-03",
    "Hoi Sam, bedankt voor de fijne sessie en de notities. Ik neem de acties door en verzamel mijn opmerkingen voor ons volgende gesprek.",
  ],
];
export const mails: Mail[] = rows.map((r, i) => ({
  id: i + 1,
  name: r[0],
  company: r[1],
  subject: r[2],
  body: r[3],
  preview: r[3],
  task: r[4],
  duration: r[5],
  priority: r[6],
  deadline: r[7],
  reply: r[8],
  time: [
    "09:12",
    "09:04",
    "08:48",
    "08:31",
    "08:15",
    "Gisteren",
    "Gisteren",
    "Gisteren",
    "Gisteren",
    "Vrijdag",
    "Vrijdag",
    "Vrijdag",
  ][i],
  color: ["lavender", "peach", "blue", "mint"][i % 4],
}));
export const initialState = (): State => ({
  tasks: [1, 3, 5].map((id, i) => {
    const m = mails[id - 1];
    return {
      id,
      mailId: id,
      title: m.task,
      duration: m.duration,
      priority: m.priority,
      deadline: m.deadline,
      done: false,
      ...(i === 2 ? { start: 14 * 60 } : {}),
    };
  }),
  drafts: mails
    .slice(0, 4)
    .map((m) => ({ mailId: m.id, text: m.reply, approved: false })),
  read: [],
});
export const fixed = [
  {
    start: 600,
    duration: 60,
    title: "Weekstart · Studio Noord",
    type: "Afspraak",
  },
  { start: 750, duration: 45, title: "Lunch & een frisse neus", type: "Pauze" },
  {
    start: 930,
    duration: 30,
    title: "Kennismaking · Groen Bureau",
    type: "Afspraak",
  },
];
export const time = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
