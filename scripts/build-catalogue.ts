import { writeFileSync } from "node:fs";

/**
 * Generates seed/paints.tamiya.json — the full current Tamiya paint
 * catalogue. Data below was compiled from the prototype's known-good `LIB`
 * array (docs/reference/tamiya-thinner-bench-prototype.html) plus a round of
 * web verification against Tamiya's own product pages and hobby-retailer
 * listings, per docs/PLAN.md §2.2. See the final report for what was
 * verified vs estimated, and for numbering gaps found along the way.
 *
 * Style follows scripts/migrate.ts: plain top-level script code, no classes.
 */

const NOW = new Date().toISOString();

// ---------------------------------------------------------------------------
// Codes whose hex was carried over verbatim from the prototype's LIB array —
// these get a real verified_at timestamp. Everything else is a fresh
// estimate from the paint's name and gets verified_at: null.
// ---------------------------------------------------------------------------

const REUSED = new Set<string>([
  // X — prototype had X-1..X-28, X-31..X-34 (X-29/X-30 don't exist; X-35 is
  // new, not in the prototype)
  "X-1", "X-2", "X-3", "X-4", "X-5", "X-6", "X-7", "X-8", "X-9", "X-10",
  "X-11", "X-12", "X-13", "X-14", "X-15", "X-16", "X-17", "X-18", "X-19",
  "X-20A", "X-21", "X-22", "X-23", "X-24", "X-25", "X-26", "X-27", "X-28",
  "X-31", "X-32", "X-33", "X-34",
  // XF — prototype had XF-1..XF-28, XF-49..XF-69
  "XF-1", "XF-2", "XF-3", "XF-4", "XF-5", "XF-6", "XF-7", "XF-8", "XF-9",
  "XF-10", "XF-11", "XF-12", "XF-13", "XF-14", "XF-15", "XF-16", "XF-17",
  "XF-18", "XF-19", "XF-20", "XF-21", "XF-22", "XF-23", "XF-24", "XF-25",
  "XF-26", "XF-27", "XF-28", "XF-49", "XF-50", "XF-51", "XF-52", "XF-53",
  "XF-54", "XF-55", "XF-56", "XF-57", "XF-58", "XF-59", "XF-60", "XF-61",
  "XF-62", "XF-63", "XF-64", "XF-65", "XF-66", "XF-67", "XF-68", "XF-69",
  // LP — prototype only had a handful
  "LP-1", "LP-2", "LP-5", "LP-7", "LP-9", "LP-11", "LP-38", "LP-48",
  // TS — prototype's LIB already covered the full current TS-1..TS-102 range
  "TS-1", "TS-2", "TS-3", "TS-4", "TS-5", "TS-6", "TS-7", "TS-8", "TS-9",
  "TS-10", "TS-11", "TS-12", "TS-13", "TS-14", "TS-15", "TS-16", "TS-17",
  "TS-18", "TS-19", "TS-20", "TS-21", "TS-22", "TS-23", "TS-24", "TS-25",
  "TS-26", "TS-27", "TS-28", "TS-29", "TS-30", "TS-31", "TS-32", "TS-33",
  "TS-34", "TS-35", "TS-36", "TS-37", "TS-38", "TS-39", "TS-40", "TS-41",
  "TS-42", "TS-43", "TS-44", "TS-45", "TS-46", "TS-47", "TS-48", "TS-49",
  "TS-50", "TS-51", "TS-52", "TS-53", "TS-54", "TS-55", "TS-56", "TS-57",
  "TS-58", "TS-59", "TS-60", "TS-61", "TS-62", "TS-63", "TS-64", "TS-65",
  "TS-66", "TS-67", "TS-68", "TS-69", "TS-70", "TS-71", "TS-72", "TS-73",
  "TS-74", "TS-75", "TS-76", "TS-77", "TS-78", "TS-79", "TS-80", "TS-81",
  "TS-82", "TS-83", "TS-84", "TS-85", "TS-86", "TS-87", "TS-88", "TS-89",
  "TS-90", "TS-91", "TS-92", "TS-93", "TS-94", "TS-95", "TS-96", "TS-97",
  "TS-98", "TS-99", "TS-100", "TS-101", "TS-102",
]);

type Row = [code: string, name: string, hex: string];

// ---------------------------------------------------------------------------
// X — acrylic gloss & metallic mini bottles. Real range: X-1..X-28,
// X-31..X-35. X-29 and X-30 do not exist (confirmed via search — Tamiya's
// numbering jumps X-28 -> X-31). X-35 (Semi-Gloss Clear) is a real, current
// code that was missing from the prototype's LIB.
// ---------------------------------------------------------------------------
const X: Row[] = [
  ["X-1", "Black", "#111214"],
  ["X-2", "White", "#f6f5f1"],
  ["X-3", "Royal Blue", "#173a86"],
  ["X-4", "Blue", "#1d4fa0"],
  ["X-5", "Green", "#0f6b3f"],
  ["X-6", "Orange", "#e2620f"],
  ["X-7", "Red", "#c1272d"],
  ["X-8", "Lemon Yellow", "#f0c419"],
  ["X-9", "Brown", "#6a3a22"],
  ["X-10", "Gun Metal", "#3b3f45"],
  ["X-11", "Chrome Silver", "#c6c9cc"],
  ["X-12", "Gold Leaf", "#c8a12b"],
  ["X-13", "Metallic Blue", "#20518f"],
  ["X-14", "Sky Blue", "#49a2d6"],
  ["X-15", "Light Green", "#8dc63f"],
  ["X-16", "Purple", "#6a3d9a"],
  ["X-17", "Pink", "#e5788f"],
  ["X-18", "Semi-Gloss Black", "#191a1d"],
  ["X-19", "Smoke", "#493f36"],
  ["X-20A", "Acrylic Thinner", "#dcdcd6"],
  ["X-21", "Flat Base", "#d8d5cc"],
  ["X-22", "Clear", "#e9e7df"],
  ["X-23", "Clear Blue", "#2f74c0"],
  ["X-24", "Clear Yellow", "#e8c22a"],
  ["X-25", "Clear Green", "#2f9c4a"],
  ["X-26", "Clear Orange", "#dd7a1a"],
  ["X-27", "Clear Red", "#c02028"],
  ["X-28", "Park Green", "#3f6b3b"],
  ["X-31", "Titanium Gold", "#b8963f"],
  ["X-32", "Titanium Silver", "#b9bcbd"],
  ["X-33", "Bronze", "#8a5a2b"],
  ["X-34", "Metallic Brown", "#6b4630"],
  ["X-35", "Semi-Gloss Clear", "#e9e7df"],
];

// ---------------------------------------------------------------------------
// XF — acrylic flat mini bottles. Real range: XF-1..XF-28, then a genuine
// gap (XF-29..XF-48 do not exist), then XF-49..XF-93. 73 colours total —
// matches Tamiya's own "73 XF flat acrylics" figure. Includes XF-83
// (Medium Sea Gray 2, RAF) and XF-84 (Dark Iron), the prototype's known gap.
// ---------------------------------------------------------------------------
const XF: Row[] = [
  ["XF-1", "Flat Black", "#1a1b1d"],
  ["XF-2", "Flat White", "#f1efe9"],
  ["XF-3", "Flat Yellow", "#e8bf22"],
  ["XF-4", "Yellow Green", "#a5b13a"],
  ["XF-5", "Flat Green", "#2f6b34"],
  ["XF-6", "Copper", "#96562c"],
  ["XF-7", "Flat Red", "#a92f28"],
  ["XF-8", "Flat Blue", "#28518c"],
  ["XF-9", "Hull Red", "#7a3b32"],
  ["XF-10", "Flat Brown", "#5b4030"],
  ["XF-11", "J.N. Green", "#33463a"],
  ["XF-12", "J.N. Grey", "#8e9490"],
  ["XF-13", "J.A. Green", "#4a4b2b"],
  ["XF-14", "J.A. Grey", "#8c8d7c"],
  ["XF-15", "Flat Flesh", "#d9a986"],
  ["XF-16", "Flat Aluminium", "#a8abad"],
  ["XF-17", "Sea Blue", "#1f4468"],
  ["XF-18", "Medium Blue", "#2b5680"],
  ["XF-19", "Sky Grey", "#b3b6ae"],
  ["XF-20", "Medium Grey", "#8b8d8c"],
  ["XF-21", "Sky", "#a8ad8a"],
  ["XF-22", "RLM Grey", "#767a72"],
  ["XF-23", "Light Blue", "#6d8fae"],
  ["XF-24", "Dark Grey", "#4d5254"],
  ["XF-25", "Light Sea Grey", "#9aa1a3"],
  ["XF-26", "Deep Green", "#2c4231"],
  ["XF-27", "Black Green", "#2a352f"],
  ["XF-28", "Dark Copper", "#7a4526"],
  ["XF-49", "Khaki", "#6f6a4b"],
  ["XF-50", "Field Blue", "#38506b"],
  ["XF-51", "Khaki Drab", "#736b45"],
  ["XF-52", "Flat Earth", "#7b6247"],
  ["XF-53", "Neutral Grey", "#6d7275"],
  ["XF-54", "Dark Sea Grey", "#606a6c"],
  ["XF-55", "Deck Tan", "#c2b393"],
  ["XF-56", "Metallic Grey", "#7d8285"],
  ["XF-57", "Buff", "#c0a878"],
  ["XF-58", "Olive Green", "#4b5535"],
  ["XF-59", "Desert Yellow", "#c2ab74"],
  ["XF-60", "Dark Yellow", "#b09a5f"],
  ["XF-61", "Dark Green", "#3f4c33"],
  ["XF-62", "Olive Drab", "#5b5b40"],
  ["XF-63", "German Grey", "#3c4145"],
  ["XF-64", "Red Brown", "#6b4239"],
  ["XF-65", "Field Grey", "#565b48"],
  ["XF-66", "Light Grey", "#9c9f9b"],
  ["XF-67", "NATO Green", "#4a4f36"],
  ["XF-68", "NATO Brown", "#5c4a35"],
  ["XF-69", "NATO Black", "#26292a"],
  ["XF-70", "Dark Green 2", "#384a30"],
  ["XF-71", "Cockpit Green (IJN)", "#3d5c46"],
  ["XF-72", "Brown (JGSDF)", "#5c4a34"],
  ["XF-73", "Dark Green (JGSDF)", "#3a4a30"],
  ["XF-74", "Olive Drab", "#55573c"],
  ["XF-75", "IJN Gray (Kure Arsenal)", "#7d8175"],
  ["XF-76", "Gray Green (IJN)", "#5f6a56"],
  ["XF-77", "IJN Gray (Sasebo Arsenal)", "#83877a"],
  ["XF-78", "Wooden Deck Tan", "#b39a6d"],
  ["XF-79", "Linoleum Deck Brown", "#5a4230"],
  ["XF-80", "Royal Light Grey", "#8f9799"],
  ["XF-81", "Dark Green 2 (RAF)", "#3d4a34"],
  ["XF-82", "Ocean Gray 2 (RAF)", "#6e7268"],
  // XF-83/84: real codes+names confirmed by search, but no verified swatch
  // source found — hex below is a best-effort estimate. See final report.
  ["XF-83", "Medium Sea Gray 2 (RAF)", "#8f948c"],
  ["XF-84", "Dark Iron", "#3a3d3f"],
  ["XF-85", "Rubber Black", "#202224"],
  ["XF-86", "Flat Clear", "#e9e7df"],
  ["XF-87", "IJN Gray (Maizuru Arsenal)", "#7b7f73"],
  ["XF-88", "Dark Yellow 2", "#b8a05c"],
  ["XF-89", "Dark Green 2", "#3c4c34"],
  ["XF-90", "Red Brown 2", "#6e4a3a"],
  ["XF-91", "IJN Gray (Yokosuka Arsenal)", "#80847a"],
  ["XF-92", "Yellow-Brown (DAK 1941)", "#b99a5c"],
  ["XF-93", "Light Brown (DAK 1942)", "#c2a06a"],
];

// ---------------------------------------------------------------------------
// LP — lacquer bottles. Real range: LP-1..LP-85, no gaps. 85 codes; two of
// them (LP-10 Lacquer Thinner, LP-22 Flat Base) are additives rather than
// colours, which lines up with retailers advertising "83 LP colours".
// ---------------------------------------------------------------------------
const LP: Row[] = [
  ["LP-1", "Black", "#111214"],
  ["LP-2", "White", "#f6f5f1"],
  ["LP-3", "Flat Black", "#1a1b1d"],
  ["LP-4", "Flat White", "#f1efe9"],
  ["LP-5", "Semi Gloss Black", "#191a1d"],
  ["LP-6", "Pure Blue", "#1450b0"],
  ["LP-7", "Pure Red", "#c8121f"],
  ["LP-8", "Pure Yellow", "#f0c000"],
  ["LP-9", "Clear", "#e9e7df"],
  ["LP-10", "Lacquer Thinner", "#dcdcd6"],
  ["LP-11", "Silver", "#c3c6c9"],
  ["LP-12", "IJN Gray (Kure Arsenal)", "#7d8175"],
  ["LP-13", "IJN Gray (Sasebo Arsenal)", "#83877a"],
  ["LP-14", "IJN Gray (Maizuru Arsenal)", "#7b7f73"],
  ["LP-15", "IJN Gray (Yokosuka Arsenal)", "#80847a"],
  ["LP-16", "Wooden Deck Tan", "#b39a6d"],
  ["LP-17", "Linoleum Deck Brown", "#5a4230"],
  ["LP-18", "Dull Red", "#8a2a26"],
  ["LP-19", "Gun Metal", "#3b3f45"],
  ["LP-20", "Light Gun Metal", "#5a5e62"],
  ["LP-21", "Italian Red", "#c2101c"],
  ["LP-22", "Flat Base", "#d8d5cc"],
  ["LP-23", "Flat Clear", "#e9e7df"],
  ["LP-24", "Semi Gloss Clear", "#e9e7df"],
  ["LP-25", "Brown (JGSDF)", "#5a4530"],
  ["LP-26", "Dark Green (JGSDF)", "#3a4a30"],
  ["LP-27", "German Gray", "#4b4e4c"],
  ["LP-28", "Olive Drab", "#5c5c3f"],
  ["LP-29", "Olive Drab 2", "#4f5138"],
  ["LP-30", "Light Sand", "#cdbb8e"],
  ["LP-31", "Dark Green 2 (IJN)", "#3c4c34"],
  ["LP-32", "Light Gray (IJN)", "#9aa19c"],
  ["LP-33", "Grey Green (IJN)", "#6a7060"],
  ["LP-34", "Light Gray", "#a6a9a4"],
  ["LP-35", "Insignia White", "#eeeee6"],
  ["LP-36", "Dark Ghost Gray", "#8a8e88"],
  ["LP-37", "Light Ghost Gray", "#b7bab2"],
  ["LP-38", "Flat Aluminium", "#a8abad"],
  ["LP-39", "Racing White", "#f5f4ef"],
  ["LP-40", "Metallic Black", "#232527"],
  ["LP-41", "Mica Blue", "#274a86"],
  ["LP-42", "Mica Red", "#7a1e22"],
  ["LP-43", "Pearl White", "#efeee6"],
  ["LP-44", "Metallic Orange", "#d1621a"],
  ["LP-45", "Racing Blue", "#143c78"],
  ["LP-46", "Pure Metallic Red", "#a8121f"],
  ["LP-47", "Pearl Blue", "#a9c8e8"],
  ["LP-48", "Sparkling Silver", "#cccfd2"],
  ["LP-49", "Pearl Clear", "#e9e7df"],
  ["LP-50", "Bright Red", "#cc1f24"],
  ["LP-51", "Pure Orange", "#e8600f"],
  ["LP-52", "Clear Red", "#c02028"],
  ["LP-53", "Clear Orange", "#dd7a1a"],
  ["LP-54", "Dark Iron", "#3a3d3f"],
  ["LP-55", "Dark Yellow 2", "#b8a05c"],
  ["LP-56", "Dark Green 2", "#3c4c34"],
  ["LP-57", "Red Brown 2", "#6e4a3a"],
  ["LP-58", "NATO Green", "#4a4f36"],
  ["LP-59", "NATO Brown", "#5c4a35"],
  ["LP-60", "NATO Black", "#26292a"],
  ["LP-61", "Metallic Gray", "#6c7073"],
  ["LP-62", "Titanium Gold", "#b8963f"],
  ["LP-63", "Titanium Silver", "#b9bcbd"],
  ["LP-64", "Olive Drab (JGSDF)", "#56583c"],
  ["LP-65", "Rubber Black", "#202224"],
  ["LP-66", "Flat Flesh", "#d9a986"],
  ["LP-67", "Smoke", "#493f36"],
  ["LP-68", "Clear Blue", "#2f74c0"],
  ["LP-69", "Clear Yellow", "#e8c22a"],
  ["LP-70", "Gloss Aluminium", "#c7cacd"],
  ["LP-71", "Champagne Gold", "#c9a86a"],
  ["LP-72", "Mica Silver", "#c7cacd"],
  ["LP-73", "Khaki", "#6f6a4b"],
  ["LP-74", "Flat Earth", "#7b6247"],
  ["LP-75", "Buff", "#c0a878"],
  ["LP-76", "Yellow-Brown (DAK 1941)", "#b99a5c"],
  ["LP-77", "Light Brown (DAK 1942)", "#c2a06a"],
  ["LP-78", "Flat Blue", "#28518c"],
  ["LP-79", "Flat Red", "#a92f28"],
  ["LP-80", "Flat Yellow", "#e8bf22"],
  ["LP-81", "Mixing Blue", "#1450b0"],
  ["LP-82", "Mixing Red", "#c8121f"],
  ["LP-83", "Mixing Yellow", "#f0c000"],
  ["LP-84", "Camouflage Grey", "#8f9388"],
  ["LP-85", "Medium Air Grey", "#9aa198"],
];

// ---------------------------------------------------------------------------
// TS — lacquer spray cans. Real current range: TS-1..TS-102, no gaps.
// (Every code here matched the prototype's LIB — reused verbatim.)
// ---------------------------------------------------------------------------
const TS: Row[] = [
  ["TS-1", "Red Brown", "#7a4530"],
  ["TS-2", "Dark Green", "#35452e"],
  ["TS-3", "Dark Yellow", "#b6a05e"],
  ["TS-4", "German Grey", "#4b4e4c"],
  ["TS-5", "Olive Drab", "#5c5c3f"],
  ["TS-6", "Matt Black", "#17181a"],
  ["TS-7", "Racing White", "#f5f4ef"],
  ["TS-8", "Italian Red", "#c2101c"],
  ["TS-9", "British Green", "#1d3d2a"],
  ["TS-10", "French Blue", "#274a86"],
  ["TS-11", "Maroon", "#5c2028"],
  ["TS-12", "Orange", "#e0651c"],
  ["TS-13", "Clear", "#e9e7df"],
  ["TS-14", "Black", "#111214"],
  ["TS-15", "Blue", "#1d4a9a"],
  ["TS-16", "Yellow", "#f0c623"],
  ["TS-17", "Gloss Aluminum", "#b9bcbe"],
  ["TS-18", "Metallic Red", "#8a1f24"],
  ["TS-19", "Metallic Blue", "#234a7a"],
  ["TS-20", "Metallic Green", "#274d33"],
  ["TS-21", "Gold", "#b98f2e"],
  ["TS-22", "Light Green", "#7cbb4a"],
  ["TS-23", "Light Blue", "#5f9fd6"],
  ["TS-24", "Purple", "#653788"],
  ["TS-25", "Pink", "#e587a0"],
  ["TS-26", "Pure White", "#f7f6f2"],
  ["TS-27", "Matt White", "#efeee8"],
  ["TS-28", "Olive Drab 2", "#4f5138"],
  ["TS-29", "Semi-Gloss Black", "#191a1d"],
  ["TS-30", "Silver Leaf", "#c9ccce"],
  ["TS-31", "Bright Orange", "#e8560f"],
  ["TS-32", "Haze Grey", "#9aa19f"],
  ["TS-33", "Dull Red", "#8a2a26"],
  ["TS-34", "Camel Yellow", "#cdaa4e"],
  ["TS-35", "Park Green", "#3f6b3b"],
  ["TS-36", "Fluorescent Red", "#ff3b30"],
  ["TS-37", "Lavender", "#9a89c4"],
  ["TS-38", "Gun Metal", "#3b3f45"],
  ["TS-39", "Mica Red", "#7a1e22"],
  ["TS-40", "Metallic Black", "#232527"],
  ["TS-41", "Coral Blue", "#2f7fae"],
  ["TS-42", "Light Gun Metal", "#5a5e62"],
  ["TS-43", "Racing Green", "#1c3d29"],
  ["TS-44", "Brilliant Blue", "#1a63c4"],
  ["TS-45", "Pearl White", "#efeee6"],
  ["TS-46", "Light Sand", "#cdbb8e"],
  ["TS-47", "Chrome Yellow", "#f0c000"],
  ["TS-48", "Gunship Grey", "#6a6f6c"],
  ["TS-49", "Bright Red", "#cc1f24"],
  ["TS-50", "Mica Blue", "#274a86"],
  ["TS-51", "Racing Blue", "#143c78"],
  ["TS-52", "Candy Lime Green", "#9ecb3c"],
  ["TS-53", "Deep Metallic Blue", "#17335c"],
  ["TS-54", "Light Metallic Blue", "#3f7fc0"],
  ["TS-55", "Dark Blue", "#16294f"],
  ["TS-56", "Brilliant Orange", "#ee5a1a"],
  ["TS-57", "Blue Violet", "#5947a0"],
  ["TS-58", "Pearl Light Blue", "#a9cbe8"],
  ["TS-59", "Pearl Light Red", "#e8a2ab"],
  ["TS-60", "Pearl Green", "#8fcf9e"],
  ["TS-61", "NATO Green", "#4a4f36"],
  ["TS-62", "NATO Brown", "#5c4a35"],
  ["TS-63", "NATO Black", "#26292a"],
  ["TS-64", "Dark Mica Blue", "#16305c"],
  ["TS-65", "Pearl Clear", "#e9e7df"],
  ["TS-66", "IJN Gray (Kure Arsenal)", "#7d8175"],
  ["TS-67", "IJN Gray (Sasebo Arsenal)", "#83877a"],
  ["TS-68", "Wooden Deck Tan", "#b39a6d"],
  ["TS-69", "Linoleum Deck Brown", "#5a4230"],
  ["TS-70", "Olive Drab (JGSDF)", "#56583c"],
  ["TS-71", "Smoke", "#493f36"],
  ["TS-72", "Clear Blue", "#2f74c0"],
  ["TS-73", "Clear Orange", "#dd7a1a"],
  ["TS-74", "Clear Red", "#c02028"],
  ["TS-75", "Champagne Gold", "#c9a86a"],
  ["TS-76", "Mica Silver", "#c7cacd"],
  ["TS-77", "Flat Flesh", "#d9a986"],
  ["TS-78", "Field Grey", "#565b48"],
  ["TS-79", "Semi Gloss Clear", "#e9e7df"],
  ["TS-80", "Flat Clear", "#e9e7df"],
  ["TS-81", "Royal Light Gray", "#8f9799"],
  ["TS-82", "Rubber Black", "#212223"],
  ["TS-83", "Metallic Silver", "#c3c6c9"],
  ["TS-84", "Metallic Gold", "#b3922f"],
  ["TS-85", "Bright Mica Red", "#a8171f"],
  ["TS-86", "Pure Red", "#d0121f"],
  ["TS-87", "Titanium Gold", "#b8963f"],
  ["TS-88", "Titanium Silver", "#b9bcbd"],
  ["TS-89", "Pearl Blue", "#a9c8e8"],
  ["TS-90", "Brown (JGSDF)", "#5a4530"],
  ["TS-91", "Dark Green (JGSDF)", "#3a4a30"],
  ["TS-92", "Metallic Orange", "#d1621a"],
  ["TS-93", "Pure Blue", "#1447a8"],
  ["TS-94", "Metallic Gray", "#6c7073"],
  ["TS-95", "Pure Metallic Red", "#a8121f"],
  ["TS-96", "Fluorescent Orange", "#ff6a1a"],
  ["TS-97", "Pearl Yellow", "#f0d98a"],
  ["TS-98", "Pure Orange", "#e8600f"],
  ["TS-99", "IJN Gray (Maizuru Arsenal)", "#7d8175"],
  ["TS-100", "Semi-Gloss Bright Gun Metal", "#4c4f52"],
  ["TS-101", "Base White", "#f5f4ef"],
  ["TS-102", "Cobalt Green", "#1f6e52"],
];

// ---------------------------------------------------------------------------
// AS — aircraft lacquer spray cans. Real range: AS-1..AS-33, no gaps.
// None of these were in the prototype's LIB — all hex values are estimates.
// ---------------------------------------------------------------------------
const AS: Row[] = [
  ["AS-1", "Dark Green (IJN)", "#33463a"],
  ["AS-2", "Light Gray (IJN)", "#9aa19c"],
  ["AS-3", "Gray Green (Luftwaffe)", "#6a7060"],
  ["AS-4", "Gray Violet (Luftwaffe)", "#6f6a78"],
  ["AS-5", "Light Blue (Luftwaffe)", "#7a9cc0"],
  ["AS-6", "Olive Drab (USAAF)", "#5b5b40"],
  ["AS-7", "Neutral Gray (USAAF)", "#6d7275"],
  ["AS-8", "Navy Blue (USN)", "#1c3a5e"],
  ["AS-9", "Dark Green (RAF)", "#2c4231"],
  ["AS-10", "Ocean Gray (RAF)", "#6e7268"],
  ["AS-11", "Medium Sea Gray (RAF)", "#8f948c"],
  ["AS-12", "Bare-Metal Silver", "#c9ccce"],
  ["AS-13", "Green (USAF)", "#4a5c3e"],
  ["AS-14", "Olive Green (USAF)", "#565c3a"],
  ["AS-15", "Tan (USAF)", "#c2a06a"],
  ["AS-16", "Light Gray (USAF)", "#9aa19c"],
  ["AS-17", "Dark Green (IJA)", "#3a4a30"],
  ["AS-18", "Light Gray (IJA)", "#9aa19c"],
  ["AS-19", "Intermediate Blue (USN)", "#5f7690"],
  ["AS-20", "Insignia White (USN)", "#eeeee6"],
  ["AS-21", "Dark Green 2 (IJN)", "#3c4c34"],
  ["AS-22", "Dark Earth", "#6b5236"],
  ["AS-23", "Light Green (Luftwaffe)", "#7c8a5a"],
  ["AS-24", "Dark Green (Luftwaffe)", "#3d4a34"],
  ["AS-25", "Dark Ghost Gray (USAAF)", "#8a8e88"],
  ["AS-26", "Light Ghost Gray (USAF/JASDF)", "#b7bab2"],
  ["AS-27", "Gunship Gray 2", "#6a6f6c"],
  ["AS-28", "Medium Gray", "#7d8184"],
  ["AS-29", "Gray Green (IJN)", "#6a7060"],
  ["AS-30", "Dark Green 2 (RAF)", "#3d4a34"],
  ["AS-31", "Ocean Gray 2 (RAF)", "#6e7268"],
  ["AS-32", "Medium Sea Gray 2 (RAF)", "#8f948c"],
  ["AS-33", "Camouflage Gray", "#8b9088"],
];

// ---------------------------------------------------------------------------
// PS — polycarbonate (RC body) spray cans. Real current range: PS-1..PS-63,
// no gaps (PS-2 "Red" is real and current, despite being easy to miss in
// retailer listings). None were in the prototype's LIB.
// ---------------------------------------------------------------------------
const PS: Row[] = [
  ["PS-1", "White", "#f6f5f1"],
  ["PS-2", "Red", "#c1272d"],
  ["PS-3", "Light Blue", "#5f9fd6"],
  ["PS-4", "Blue", "#1d4fa0"],
  ["PS-5", "Black", "#111214"],
  ["PS-6", "Yellow", "#f0c419"],
  ["PS-7", "Orange", "#e2620f"],
  ["PS-8", "Light Green", "#8dc63f"],
  ["PS-9", "Green", "#0f6b3f"],
  ["PS-10", "Purple", "#6a3d9a"],
  ["PS-11", "Pink", "#e5788f"],
  ["PS-12", "Silver", "#c6c9cc"],
  ["PS-13", "Gold", "#c8a12b"],
  ["PS-14", "Copper", "#96562c"],
  ["PS-15", "Metallic Red", "#8a1f24"],
  ["PS-16", "Metallic Blue", "#234a7a"],
  ["PS-17", "Metallic Green", "#274d33"],
  ["PS-18", "Metallic Purple", "#5a3a7a"],
  ["PS-19", "Camel Yellow", "#cdaa4e"],
  ["PS-20", "Fluorescent Red", "#ff3b30"],
  ["PS-21", "Park Green", "#3f6b3b"],
  ["PS-22", "Racing Green", "#1c3d29"],
  ["PS-23", "Gun Metal", "#3b3f45"],
  ["PS-24", "Fluorescent Orange", "#ff6a1a"],
  ["PS-25", "Bright Green", "#4fb14a"],
  ["PS-26", "Protective Top Coat", "#e9e7df"],
  ["PS-27", "Fluorescent Yellow", "#f0f01a"],
  ["PS-28", "Fluorescent Green", "#4dff5a"],
  ["PS-29", "Fluorescent Pink", "#ff6aa0"],
  ["PS-30", "Brilliant Blue", "#1a63c4"],
  ["PS-31", "Smoke", "#493f36"],
  ["PS-32", "Corsa Gray", "#6a6f6c"],
  ["PS-33", "Cherry Red", "#a8121f"],
  ["PS-34", "Bright Red", "#cc1f24"],
  ["PS-35", "Blue Violet", "#5947a0"],
  ["PS-36", "Translucent Silver", "#c9ccce"],
  ["PS-37", "Translucent Red", "#c02028"],
  ["PS-38", "Translucent Blue", "#2f74c0"],
  ["PS-39", "Translucent Light Blue", "#a9cbe8"],
  ["PS-40", "Translucent Pink", "#e8a2ab"],
  ["PS-41", "Bright Silver", "#c9ccce"],
  ["PS-42", "Translucent Yellow", "#e8c22a"],
  ["PS-43", "Translucent Orange", "#dd7a1a"],
  ["PS-44", "Translucent Green", "#2f9c4a"],
  ["PS-45", "Translucent Purple", "#653788"],
  ["PS-46", "Purple/Green Iridescent", "#6a4a8a"],
  ["PS-47", "Pink/Gold Iridescent", "#c98aa0"],
  ["PS-48", "Metallic Silver", "#c3c6c9"],
  ["PS-49", "Sky Blue Anodized Aluminum", "#7ab0d6"],
  ["PS-50", "Sparkling Pink Anodized Aluminum", "#e8a2c0"],
  ["PS-51", "Purple Anodized Aluminum", "#8a6ab0"],
  ["PS-52", "Champagne Gold Anodized Aluminum", "#c9a86a"],
  ["PS-53", "Color-Change Gold Flake", "#b3922f"],
  ["PS-54", "Cobalt Green", "#1f6e52"],
  ["PS-55", "Flat Clear", "#e9e7df"],
  ["PS-56", "Mustard Yellow", "#c2a028"],
  ["PS-57", "Pearl White", "#efeee6"],
  ["PS-58", "Pearl Clear", "#e9e7df"],
  ["PS-59", "Dark Metallic Blue", "#17335c"],
  ["PS-60", "Bright Mica Red", "#a8171f"],
  ["PS-61", "Metallic Orange", "#d1621a"],
  ["PS-62", "Pure Orange", "#e8600f"],
  ["PS-63", "Bright Gun Metal", "#4c4f52"],
];

// ---------------------------------------------------------------------------
// Primers. Tamiya doesn't give these X/XF-style numeric codes, so we use
// stable slugs (docs/PLAN.md §2.2). Verified via search:
//  - Fine Surface Primer currently ships as "L" (180ml spray) in Light Grey,
//    White, Oxide Red and Pink. No "M" or "S" size, and no Black shade,
//    turned up anywhere in Tamiya's current lineup or product pages — so
//    those are dropped rather than invented. This deviates from the task
//    brief's starter slugs (PRIMER-FINE-M-* / PRIMER-FINE-S-LGREY), which
//    assumed sizes that don't seem to exist; see final report.
//  - Liquid Surface Primer ships as a 40ml bottle in Grey and White, as
//    expected.
// ---------------------------------------------------------------------------
type PrimerRow = {
  code: string;
  name: string;
  hex: string;
  sizeMl: number;
};

const PRIMERS: PrimerRow[] = [
  { code: "PRIMER-FINE-L-GREY", name: "Fine Surface Primer L, Light Grey", hex: "#b7b9b4", sizeMl: 180 },
  { code: "PRIMER-FINE-L-WHITE", name: "Fine Surface Primer L, White", hex: "#e9e6dd", sizeMl: 180 },
  { code: "PRIMER-FINE-OXIDE-RED", name: "Fine Surface Primer L, Oxide Red", hex: "#8a3b28", sizeMl: 180 },
  { code: "PRIMER-FINE-L-PINK", name: "Fine Surface Primer L, Pink", hex: "#e8a0ac", sizeMl: 180 },
  { code: "PRIMER-LIQUID-GREY", name: "Liquid Surface Primer, Grey", hex: "#9a9c98", sizeMl: 40 },
  { code: "PRIMER-LIQUID-WHITE", name: "Liquid Surface Primer, White", hex: "#efeee8", sizeMl: 40 },
];

// ---------------------------------------------------------------------------
// Classification — ports the prototype's ratio-family logic, generalized
// per docs/PLAN.md §2.2's mapping rules.
// ---------------------------------------------------------------------------

const METALLIC_RE =
  /metallic|chrome|aluminu?m|\bgold\b|\bsilver\b|pearl|titanium|gun.?metal|copper|bronze|mica|sparkling|flake/i;

function familyFor(line: string, code: string, name: string): string {
  if (line === "LP") return "lacquer";
  if (line === "TS" || line === "AS") return "sprayDecant";
  if (line === "PS") return "polycarb";
  if (line === "PRIMER") return "primer";
  if (line === "X") {
    if (code === "X-20A" || code === "X-21") return "additive";
    if (METALLIC_RE.test(name)) return "metallic";
    if (/semi.?gloss/i.test(name)) return "semi";
    if (/clear|smoke/i.test(name)) return "clear";
    return "gloss";
  }
  if (line === "XF") {
    if (METALLIC_RE.test(name)) return "metallic";
    return "flat";
  }
  throw new Error(`unhandled line: ${line}`);
}

function finishFor(line: string, family: string, name: string): string | null {
  if (family === "additive") return null;
  if (line === "PRIMER") return "flat";
  if (/clear/i.test(name)) return "clear";
  if (/flat/i.test(name)) return "flat";
  if (/semi.?gloss/i.test(name)) return "semi";
  if (METALLIC_RE.test(name)) return "metallic";
  // The task's "else -> gloss" default is spelled out for LP/TS/AS/PS/X
  // bottles specifically; XF is a flat-only line (like its family), so an
  // XF paint with no flat/semi/clear/metallic keyword in its name (e.g.
  // "Khaki", "Neutral Grey") still finishes flat rather than falling
  // through to the generic gloss default.
  if (line === "XF") return "flat";
  return "gloss";
}

function sizeFor(line: string): number {
  if (line === "X" || line === "XF" || line === "LP") return 10;
  if (line === "TS" || line === "AS" || line === "PS") return 100;
  throw new Error(`unhandled line for size: ${line}`);
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

type PaintOut = {
  code: string;
  line: string;
  name: string;
  hex: string;
  family: string;
  finish: string | null;
  size_ml: number;
  discontinued: boolean;
  verified_at: string | null;
};

function build(line: string, rows: Row[]): PaintOut[] {
  return rows.map(([code, name, hex]) => {
    const family = familyFor(line, code, name);
    return {
      code,
      line,
      name,
      hex,
      family,
      finish: finishFor(line, family, name),
      size_ml: sizeFor(line),
      discontinued: false,
      verified_at: REUSED.has(code) ? NOW : null,
    };
  });
}

const primerOut: PaintOut[] = PRIMERS.map((p) => ({
  code: p.code,
  line: "PRIMER",
  name: p.name,
  hex: p.hex,
  family: "primer",
  finish: "flat",
  size_ml: p.sizeMl,
  discontinued: false,
  verified_at: null,
}));

const all: PaintOut[] = [
  ...build("X", X),
  ...build("XF", XF),
  ...build("LP", LP),
  ...build("TS", TS),
  ...build("AS", AS),
  ...build("PS", PS),
  ...primerOut,
];

// Sort: by line in the fixed order X, XF, LP, TS, AS, PS, PRIMER, then
// naturally/numerically by code within each line.
const LINE_ORDER = ["X", "XF", "LP", "TS", "AS", "PS", "PRIMER"];

function codeSortKey(code: string): [number, string] {
  const m = code.match(/^[A-Z]+-(\d+)([A-Z]*)$/);
  if (!m) return [Number.MAX_SAFE_INTEGER, code];
  return [Number(m[1]), m[2]];
}

all.sort((a, b) => {
  const lineDiff = LINE_ORDER.indexOf(a.line) - LINE_ORDER.indexOf(b.line);
  if (lineDiff !== 0) return lineDiff;
  const [numA, suffixA] = codeSortKey(a.code);
  const [numB, suffixB] = codeSortKey(b.code);
  if (numA !== numB) return numA - numB;
  return suffixA.localeCompare(suffixB);
});

writeFileSync("seed/paints.tamiya.json", JSON.stringify(all, null, 2) + "\n");

console.log(`Wrote seed/paints.tamiya.json — ${all.length} paints.`);
for (const line of LINE_ORDER) {
  const count = all.filter((p) => p.line === line).length;
  console.log(`  ${line}: ${count}`);
}
const estimated = all.filter((p) => p.verified_at === null).length;
console.log(`Verified hex (reused from prototype): ${all.length - estimated}`);
console.log(`Estimated hex (verified_at: null): ${estimated}`);
