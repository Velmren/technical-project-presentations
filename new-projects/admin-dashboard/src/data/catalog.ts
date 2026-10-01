import type { Category, Product, TeamRole, User } from "./types";

type ProductSeed = Omit<Product, "description" | "stock"> & {
  popularity: number;
  launched: string;
  retired?: string;
  priceBefore?: { price: number; until: string };
  stock: number;
};

export const categories: Category[] = ["Lighting", "Audio", "Desk", "Power", "Carry"];

export const productSeeds: ProductSeed[] = [
  { id: "PRD-01", sku: "NL-ARC-01", name: "Arc Desk Lamp", category: "Lighting", price: 149, cost: 58, stock: 64, reorderPoint: 20, status: "Active", art: "lamp", popularity: 10, launched: "2025-04-01", image: "arc-desk-lamp" },
  { id: "PRD-02", sku: "NL-HAL-01", name: "Halo Floor Lamp", category: "Lighting", price: 289, cost: 112, stock: 9, reorderPoint: 12, status: "Active", art: "lamp", popularity: 3, launched: "2025-09-15", image: "halo-floor-lamp" },
  { id: "PRD-03", sku: "NL-PEB-01", name: "Pebble Speaker", category: "Audio", price: 119, cost: 44, stock: 142, reorderPoint: 30, status: "Active", art: "speaker", popularity: 10, launched: "2025-04-01", image: "pebble-speaker" },
  { id: "PRD-04", sku: "NL-HSH-01", name: "Hush Headphones", category: "Audio", price: 229, cost: 91, stock: 4, reorderPoint: 20, status: "Active", art: "headphones", popularity: 6, launched: "2025-04-01", priceBefore: { price: 219, until: "2026-03-01" }, image: "hush-headphones" },
  { id: "PRD-05", sku: "NL-GRD-01", name: "Grid Keyboard", category: "Desk", price: 169, cost: 63, stock: 38, reorderPoint: 15, status: "Active", art: "keyboard", popularity: 7, launched: "2025-04-01", image: "grid-keyboard" },
  { id: "PRD-06", sku: "NL-GLD-01", name: "Glide Mouse", category: "Desk", price: 69, cost: 22, stock: 212, reorderPoint: 40, status: "Active", art: "dock", popularity: 14, launched: "2025-06-02", image: "glide-mouse" },
  { id: "PRD-07", sku: "NL-RSE-01", name: "Rise Laptop Stand", category: "Desk", price: 89, cost: 29, stock: 96, reorderPoint: 25, status: "Active", art: "stand", popularity: 12, launched: "2025-04-01", image: "rise-laptop-stand" },
  { id: "PRD-08", sku: "NL-LNK-01", name: "Link USB-C Dock", category: "Power", price: 129, cost: 47, stock: 0, reorderPoint: 15, status: "Active", art: "dock", popularity: 8, launched: "2025-04-01", retired: "2026-09-26", image: "link-usb-c-dock" },
  { id: "PRD-09", sku: "NL-VLT-01", name: "Volt Charging Pad", category: "Power", price: 59, cost: 18, stock: 184, reorderPoint: 40, status: "Active", art: "dock", popularity: 12, launched: "2025-05-12", image: "volt-charging-pad" },
  { id: "PRD-10", sku: "NL-FLD-01", name: "Field Desk Mat", category: "Desk", price: 49, cost: 14, stock: 73, reorderPoint: 30, status: "Active", art: "stand", popularity: 11, launched: "2025-04-01", image: "field-desk-mat" },
  { id: "PRD-11", sku: "NL-CNV-01", name: "Canvas Tech Pouch", category: "Carry", price: 45, cost: 13, stock: 51, reorderPoint: 25, status: "Active", art: "dock", popularity: 9, launched: "2025-07-07", image: "canvas-tech-pouch" },
  { id: "PRD-12", sku: "NL-TRN-01", name: "Transit Backpack", category: "Carry", price: 179, cost: 64, stock: 19, reorderPoint: 15, status: "Active", art: "dock", popularity: 5, launched: "2025-10-20", image: "transit-backpack" },
  { id: "PRD-13", sku: "NL-ARC-02", name: "Arc Mini Lamp", category: "Lighting", price: 99, cost: 39, stock: 0, reorderPoint: 20, status: "Draft", art: "lamp", popularity: 0, launched: "2026-10-01", image: "arc-desk-lamp" },
  { id: "PRD-14", sku: "NL-LOP-01", name: "Loop Cable Kit", category: "Power", price: 29, cost: 8, stock: 0, reorderPoint: 0, status: "Archived", art: "dock", popularity: 4, launched: "2025-04-01", retired: "2026-02-14" },
];

type TeamSeed = Omit<User, "avatar" | "country"> & { role: TeamRole };

export const teamSeeds: TeamSeed[] = [
  { id: "USR-001", name: "Alex Morgan", email: "alex@northline.example", role: "Owner", status: "Active", joined: "2025-03-12", region: "Dublin, IE", title: { key: "team.title.founder" } },
  { id: "USR-002", name: "Maya Chen", email: "maya@northline.example", role: "Manager", status: "Active", joined: "2025-03-20", region: "Amsterdam, NL", title: { key: "team.title.operations" } },
  { id: "USR-003", name: "Theo Laurent", email: "theo@northline.example", role: "Manager", status: "Active", joined: "2025-05-06", region: "Lyon, FR", title: { key: "team.title.catalog" } },
  { id: "USR-004", name: "Nina Patel", email: "nina@northline.example", role: "Support", status: "Active", joined: "2025-04-14", region: "Manchester, GB", title: { key: "team.title.careLead" } },
  { id: "USR-005", name: "Oskar Berg", email: "oskar@northline.example", role: "Support", status: "Active", joined: "2025-11-03", region: "Gothenburg, SE", title: { key: "team.title.care" } },
  { id: "USR-006", name: "Isla Reed", email: "isla@northline.example", role: "Support", status: "Invited", joined: "2026-09-25", region: "Edinburgh, GB", title: { key: "team.title.care" } },
  { id: "USR-007", name: "Jonas Keller", email: "jonas@northline.example", role: "Fulfilment", status: "Active", joined: "2025-03-28", region: "Dublin, IE", title: { key: "team.title.warehouseLead" } },
  { id: "USR-008", name: "Priya Nair", email: "priya@northline.example", role: "Fulfilment", status: "Active", joined: "2025-06-16", region: "Dublin, IE", title: { key: "team.title.fulfilment" } },
  { id: "USR-009", name: "Rui Santos", email: "rui@northline.example", role: "Fulfilment", status: "Active", joined: "2025-10-01", region: "Dublin, IE", title: { key: "team.title.fulfilment" } },
  { id: "USR-010", name: "Hanna Lindqvist", email: "hanna@northline.example", role: "Finance", status: "Active", joined: "2025-04-22", region: "Stockholm, SE", title: { key: "team.title.finance" } },
  { id: "USR-011", name: "Marco Bellini", email: "marco@northline.example", role: "Manager", status: "Active", joined: "2025-08-11", region: "Milan, IT", title: { key: "team.title.growth" } },
  { id: "USR-012", name: "Zoe Adeyemi", email: "zoe@northline.example", role: "Support", status: "Active", joined: "2026-02-09", region: "London, GB", title: { key: "team.title.care" } },
  { id: "USR-013", name: "Liam O'Connor", email: "liam@northline.example", role: "Fulfilment", status: "Active", joined: "2025-12-01", region: "Cork, IE", title: { key: "team.title.returns" } },
  { id: "USR-014", name: "Sara Kowalski", email: "sara@northline.example", role: "Finance", status: "Active", joined: "2026-05-18", region: "Warsaw, PL", title: { key: "team.title.accounts" } },
];

export const fulfilmentTeam = ["USR-007", "USR-008", "USR-009", "USR-013"];
export const supportTeam = ["USR-004", "USR-005", "USR-012"];

type Country = { code: string; weight: number; cities: [string, number][]; first: string[]; last: string[]; days: number };

// Delivery days are typical courier times from a Dublin warehouse.
export const countries: Country[] = [
  { code: "GB", weight: 18, days: 2, cities: [["London", 8], ["Manchester", 3], ["Bristol", 2], ["Leeds", 2], ["Edinburgh", 2], ["Brighton", 1], ["Bath", 1], ["Glasgow", 2]], first: ["Oliver", "Amelia", "Harry", "Isla", "Jack", "Ava", "George", "Freya", "Noah", "Grace", "Samuel", "Poppy", "Ethan", "Chloe", "Alfie", "Lily"], last: ["Clarke", "Taylor", "Walker", "Hughes", "Wright", "Evans", "Turner", "Hall", "Wood", "Harris", "Bennett", "Morris", "Price", "Ward"] },
  { code: "DE", weight: 17, days: 3, cities: [["Berlin", 6], ["Hamburg", 4], ["Munich", 4], ["Cologne", 3], ["Frankfurt", 3], ["Leipzig", 2], ["Stuttgart", 2]], first: ["Emil", "Lena", "Felix", "Mia", "Paul", "Hannah", "Jonas", "Lea", "Lukas", "Clara", "Max", "Sophie", "Moritz", "Marie", "Finn", "Anna"], last: ["Fischer", "Weber", "Schneider", "Becker", "Hoffmann", "Wagner", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Braun", "Zimmermann", "Kraus"] },
  { code: "IE", weight: 9, days: 1, cities: [["Dublin", 8], ["Cork", 3], ["Galway", 2], ["Limerick", 1], ["Kilkenny", 1]], first: ["Ella", "Conor", "Aoife", "Sean", "Niamh", "Cian", "Saoirse", "Darragh", "Ciara", "Eoin", "Roisin", "Fionn"], last: ["Murphy", "Kelly", "Byrne", "Ryan", "Walsh", "O'Brien", "Doyle", "McCarthy", "Gallagher", "Kennedy", "Lynch", "Quinn"] },
  { code: "NL", weight: 9, days: 2, cities: [["Amsterdam", 5], ["Rotterdam", 3], ["Utrecht", 3], ["The Hague", 2], ["Eindhoven", 2]], first: ["Daan", "Emma", "Sem", "Julia", "Lucas", "Tess", "Milan", "Sara", "Bram", "Fleur", "Jesse", "Noor"], last: ["de Vries", "Jansen", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "Bos", "Vos", "Peters", "Hendriks"] },
  { code: "FR", weight: 10, days: 3, cities: [["Paris", 7], ["Lyon", 3], ["Bordeaux", 2], ["Nantes", 2], ["Lille", 2], ["Toulouse", 2], ["Marseille", 2]], first: ["Chloe", "Hugo", "Lea", "Louis", "Manon", "Gabriel", "Camille", "Arthur", "Ines", "Jules", "Alice", "Nathan"], last: ["Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Simon", "Michel", "Lefebvre", "Garnier", "Roux", "Fontaine", "Girard"] },
  { code: "ES", weight: 7, days: 4, cities: [["Madrid", 4], ["Barcelona", 4], ["Valencia", 2], ["Seville", 1], ["Bilbao", 1], ["Malaga", 1]], first: ["Sofia", "Pablo", "Lucia", "Hugo", "Martina", "Alejandro", "Paula", "Daniel", "Carmen", "Diego", "Elena", "Mateo"], last: ["Alvarez", "Garcia", "Martinez", "Lopez", "Sanchez", "Romero", "Navarro", "Torres", "Ruiz", "Moreno", "Castro", "Ortega"] },
  { code: "IT", weight: 6, days: 4, cities: [["Milan", 4], ["Rome", 3], ["Turin", 2], ["Bologna", 2], ["Florence", 1]], first: ["Luca", "Giulia", "Marco", "Chiara", "Matteo", "Francesca", "Lorenzo", "Sara", "Andrea", "Alice", "Tommaso", "Elisa"], last: ["Moretti", "Rossi", "Russo", "Ferrari", "Esposito", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo"] },
  { code: "SE", weight: 5, days: 3, cities: [["Stockholm", 4], ["Gothenburg", 2], ["Malmo", 2], ["Uppsala", 1]], first: ["Elsa", "William", "Alva", "Oscar", "Maja", "Hugo", "Astrid", "Liam", "Ebba", "Axel"], last: ["Nilsson", "Andersson", "Johansson", "Larsson", "Karlsson", "Eriksson", "Persson", "Olsson", "Svensson", "Lindberg"] },
  { code: "DK", weight: 3, days: 3, cities: [["Copenhagen", 4], ["Aarhus", 2], ["Odense", 1]], first: ["Freya", "Magnus", "Ida", "Oliver", "Clara", "Emil", "Karla", "Victor"], last: ["Jensen", "Nielsen", "Hansen", "Pedersen", "Andersen", "Christensen", "Larsen", "Rasmussen"] },
  { code: "NO", weight: 2, days: 4, cities: [["Oslo", 3], ["Bergen", 2], ["Trondheim", 1]], first: ["Henrik", "Nora", "Jakob", "Ingrid", "Sander", "Sofie", "Mathias", "Thea"], last: ["Dahl", "Hansen", "Johansen", "Olsen", "Berg", "Haugen", "Lie", "Moen"] },
  { code: "FI", weight: 2, days: 4, cities: [["Helsinki", 3], ["Tampere", 1], ["Turku", 1]], first: ["Aino", "Eero", "Helmi", "Leo", "Venla", "Onni", "Iida", "Elias"], last: ["Korhonen", "Virtanen", "Makinen", "Nieminen", "Heikkinen", "Laine", "Koskinen", "Lehtonen"] },
  { code: "PL", weight: 4, days: 3, cities: [["Warsaw", 4], ["Krakow", 2], ["Wroclaw", 2], ["Gdansk", 1], ["Poznan", 1]], first: ["Zofia", "Jakub", "Hanna", "Antoni", "Maja", "Szymon", "Julia", "Kacper", "Lena", "Filip"], last: ["Nowak", "Kowalczyk", "Wisniewska", "Zielinski", "Lewandowski", "Wojcik", "Kaminski", "Mazur", "Krawczyk", "Dabrowski"] },
  { code: "CZ", weight: 2, days: 3, cities: [["Prague", 4], ["Brno", 2]], first: ["Eliska", "Jan", "Tereza", "Tomas", "Anna", "Milan", "Klara", "Adam"], last: ["Novak", "Svoboda", "Dvorak", "Cerny", "Prochazka", "Kucera", "Vesely", "Horak"] },
  { code: "AT", weight: 3, days: 3, cities: [["Vienna", 4], ["Graz", 1], ["Salzburg", 1], ["Linz", 1]], first: ["Felix", "Anna", "Tobias", "Laura", "David", "Leonie", "Elias", "Valentina"], last: ["Gruber", "Huber", "Bauer", "Wagner", "Pichler", "Steiner", "Moser", "Mayer"] },
  { code: "BE", weight: 3, days: 2, cities: [["Brussels", 3], ["Antwerp", 2], ["Ghent", 2], ["Leuven", 1]], first: ["Louise", "Arthur", "Olivia", "Jules", "Elise", "Victor", "Marie", "Lars"], last: ["Peeters", "Janssens", "Maes", "Jacobs", "Willems", "Claes", "Goossens", "Wouters"] },
  { code: "PT", weight: 2, days: 4, cities: [["Lisbon", 3], ["Porto", 2], ["Braga", 1]], first: ["Ines", "Joao", "Beatriz", "Tiago", "Mariana", "Rodrigo", "Leonor", "Duarte"], last: ["Costa", "Silva", "Santos", "Ferreira", "Pereira", "Oliveira", "Rodrigues", "Martins"] },
  { code: "CH", weight: 3, days: 3, cities: [["Zurich", 3], ["Geneva", 2], ["Basel", 1], ["Bern", 1]], first: ["Lea", "Noah", "Mila", "Luca", "Nina", "Levin", "Alina", "Jan"], last: ["Schneider", "Meier", "Keller", "Brunner", "Baumann", "Frei", "Gerber", "Moser"] },
];
