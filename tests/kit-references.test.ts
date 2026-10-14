import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KIT_CATEGORIES } from "@/domain/kit";
import { referenceLinks, spotmodelSearchUrl } from "@/domain/kit-references";

const delta = { brand: "NuNu", kitNumber: "PN24030", name: "Lancia Delta S4 Martini Monte Carlo Rally 1986", category: "cars" };
const labels = (kit: Parameters<typeof referenceLinks>[0]) => referenceLinks(kit).map((l) => l.label);

describe("referenceLinks", () => {
  test("build videos first, then the category's photo searches", () => {
    assert.deepEqual(labels(delta), ["Build videos", "Exterior", "Cockpit", "Engine", "On the road"]);
    assert.equal(referenceLinks(delta)[0]?.where, "YouTube");
  });

  test("a bike isn't asked for a cockpit", () => {
    const bike = labels({ ...delta, name: "Honda RC213V 2014", category: "motorcycles" });
    assert.ok(bike.includes("Controls"));
    assert.ok(!bike.includes("Cockpit"));
  });

  test("every category has build videos and at least one photo search", () => {
    for (const category of KIT_CATEGORIES) {
      const links = referenceLinks({ ...delta, category });
      assert.equal(links[0]?.label, "Build videos", category);
      assert.ok(links.length >= 2, category);
    }
  });

  test("an unknown category gets the plain reference search", () => {
    assert.deepEqual(labels({ ...delta, category: null }), ["Build videos", "Reference"]);
  });

  test("searches are about the real thing, in Google Images", () => {
    const cockpit = referenceLinks(delta).find((l) => l.label === "Cockpit");
    assert.equal(cockpit?.query, "Lancia Delta S4 Martini Monte Carlo Rally 1986 cockpit interior");
    assert.equal(cockpit?.url, `https://www.google.com/search?udm=2&q=${encodeURIComponent(cockpit!.query)}`);
  });

  test("a kit with no name searches by brand and number", () => {
    const exterior = referenceLinks({ ...delta, name: null }).find((l) => l.label === "Exterior");
    assert.equal(exterior?.query, "NuNu PN24030");
  });

  test("with nothing to search for, only build videos remain", () => {
    assert.deepEqual(labels({ brand: null, kitNumber: null, name: null, category: "cars" }), ["Build videos"]);
  });
});

describe("spotmodelSearchUrl", () => {
  test("searches the kit number, the field the shop indexes on", () => {
    assert.equal(spotmodelSearchUrl(delta), "https://www.spotmodel.com/advanced_search_results.php?keywords=PN24030");
  });

  test("falls back to the name, and to nothing", () => {
    assert.equal(spotmodelSearchUrl({ kitNumber: null, name: "Delta S4" }), "https://www.spotmodel.com/advanced_search_results.php?keywords=Delta%20S4");
    assert.equal(spotmodelSearchUrl({ kitNumber: null, name: null }), null);
  });
});
